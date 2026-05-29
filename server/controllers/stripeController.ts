import { Request, Response } from 'express';
import type Stripe from 'stripe';
import stripe from '../configs/stripe.js';
import prisma from '../lib/prisma.js';

// ----------------------------------------------------------------------------
// Stripe webhook — grants credits only after a verified, completed payment.
// IMPORTANT: this route must receive the RAW request body (express.raw),
// registered BEFORE express.json() in server.ts.
// ----------------------------------------------------------------------------
export const stripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET || ''
        );
    } catch (err: any) {
        console.log('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const { transactionId, userId, credits } = session.metadata || {};

            if (transactionId && userId && credits) {
                const transaction = await prisma.transaction.findUnique({
                    where: { id: transactionId },
                });

                // Idempotency: only credit once
                if (transaction && !transaction.isPaid) {
                    await prisma.transaction.update({
                        where: { id: transactionId },
                        data: { isPaid: true },
                    });
                    await prisma.user.update({
                        where: { id: userId },
                        data: { credits: { increment: Number(credits) } },
                    });
                }
            }
        }

        res.json({ received: true });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
