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
                // Idempotency, atomic version.
                //
                // The previous code read the row (findUnique), then wrote it
                // (update). Between those two awaits the event loop can run
                // another webhook handler for the SAME transaction: both read
                // isPaid === false, both credit the user. Classic TOCTOU
                // (time-of-check to time-of-use) race.
                //
                // Fix: let the DATABASE decide the winner. `updateMany` with
                // `isPaid: false` in the WHERE clause is a single atomic
                // statement: the first webhook matches 1 row and flips the
                // flag, every duplicate matches 0 rows. Both writes run inside
                // one transaction so the flag and the credits can never diverge.
                const granted = await prisma.$transaction(async (tx) => {
                    const claim = await tx.transaction.updateMany({
                        where: { id: transactionId, isPaid: false },
                        data: { isPaid: true },
                    });

                    if (claim.count !== 1) return false; // deja traite

                    await tx.user.update({
                        where: { id: userId },
                        data: { credits: { increment: Number(credits) } },
                    });
                    return true;
                });

                if (!granted) {
                    console.log(`Duplicate webhook ignored for transaction ${transactionId}`);
                }
            }
        }

        res.json({ received: true });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
