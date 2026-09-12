import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { aiChat, AI_MODEL, AI_MODELS } from '../configs/openai.js';
import stripe from '../configs/stripe.js';

// Credit costs / pricing config
const PROJECT_CREATION_COST = 5;

// Available credit plans (used by purchaseCredits)
const CREDIT_PLANS: Record<string, { credits: number; amount: number }> = {
    basic: { credits: 100, amount: 5 },
    pro: { credits: 400, amount: 19 },
    enterprise: { credits: 1000, amount: 49 },
};

// ----------------------------------------------------------------------------
// Get user credits
// ----------------------------------------------------------------------------
export const getUserCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        res.json({ credits: user?.credits ?? 0 });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Get the current user's profile (name, email, credits, usage)
// ----------------------------------------------------------------------------
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                credits: true,
                totalCreation: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Update the current user's profile (name)
// ----------------------------------------------------------------------------
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { name: name.trim() },
            select: { id: true, name: true, email: true },
        });

        res.json({ user });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Delete the current user's account (and all related data)
// ----------------------------------------------------------------------------
export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Projects have no cascade from User, so remove them first
        // (this cascades their conversations and versions).
        await prisma.$transaction([
            prisma.websiteProject.deleteMany({ where: { userId } }),
            prisma.user.delete({ where: { id: userId } }),
        ]);

        res.json({ success: true });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Create a new project (enhance prompt -> generate website -> save version)
// ----------------------------------------------------------------------------
export const createUserProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    try {
        const { initial_prompt } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!initial_prompt) {
            return res.status(400).json({ message: 'initial_prompt is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (user && user.credits < PROJECT_CREATION_COST) {
            return res.status(403).json({ message: 'Add credits to create more projects' });
        }

        // Create a new project
        const project = await prisma.websiteProject.create({
            data: {
                name: initial_prompt.length > 50 ? initial_prompt.substring(0, 47) + '...' : initial_prompt,
                initial_prompt,
                userId,
            },
        });

        // Update creation count and deduct credits
        await prisma.user.update({
            where: { id: userId },
            data: {
                totalCreation: { increment: 1 },
                credits: { decrement: PROJECT_CREATION_COST },
            },
        });

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: initial_prompt,
                projectId: project.id,
            },
        });

        // The website itself is generated by the streaming endpoint
        // (generateProject) which the client calls right after navigation.
        res.json({ projectId: project.id });
    } catch (error: any) {
        // Refund the credits if creation failed
        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: PROJECT_CREATION_COST } },
            }).catch(() => {});
        }
        console.log(error);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};

const cleanCode = (raw: string) =>
    raw.replace(/```[a-z]*\n/gi, '').replace(/```$/g, '').trim();

// Projects currently being generated, to prevent duplicate concurrent streams
const generatingProjects = new Set<string>();

// ----------------------------------------------------------------------------
// Stream the initial website generation over SSE.
// Enhances the prompt, then streams the generated HTML token by token so the
// client can render the site as it is being built.
// ----------------------------------------------------------------------------
export const generateProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    const { projectId } = req.params as Record<string, string>;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const project = await prisma.websiteProject.findFirst({
        where: { id: projectId, userId },
    });
    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    // Guard against double-generation (already done, or a stream in progress)
    const versionCount = await prisma.version.count({ where: { projectId } });
    if (versionCount > 0) {
        return res.status(409).json({ message: 'Project already generated' });
    }
    if (generatingProjects.has(projectId)) {
        return res.status(409).json({ message: 'Generation already in progress' });
    }
    generatingProjects.add(projectId);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
    (res as any).flushHeaders?.();

    const send = (event: string, data: any) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
        // ---- Step 1: enhance the user prompt ----
        // Chaque generation coute deux appels au fournisseur. Sur un endpoint
        // gratuit, AI_ENHANCE=false divise la consommation par deux.
        let enhancedPromptStep = project.initial_prompt;
        if (process.env.AI_ENHANCE !== 'false') {
        send('status', { message: 'Enhancing your prompt...' });
        const enhanceResponse = await aiChat({
            // modele et fallbacks: AI_MODELS
            messages: [
                {
                    role: 'system',
                    content: `You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed, comprehensive prompt that will help create the best possible website.

Enhance this prompt by:
    1. Adding specific design details (layout, color scheme, typography)
    2. Specifying key sections and features
    3. Describing the user experience and interactions
    4. Including modern web design best practices
    5. Mentioning responsive design requirements
    6. Adding any missing but important elements

Return ONLY the enhanced prompt, nothing else. Make it detailed but concise (2-3 paragraphs max).`,
                },
                { role: 'user', content: project.initial_prompt },
            ],
        });

        enhancedPromptStep = enhanceResponse.choices[0].message.content || project.initial_prompt;

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: `I've enhanced your prompt to: "${enhancedPromptStep}"`,
                projectId: project.id,
            },
        });
        }
        const enhancedPrompt = enhancedPromptStep;

        // ---- Step 2: stream the generated website code ----
        send('status', { message: 'Generating your website...' });
        const stream = await aiChat({
            // modele et fallbacks: AI_MODELS
            stream: true,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert web developer. Create a complete, production-ready, single-page website based on this request: "${enhancedPrompt}"

CRITICAL REQUIREMENTS:
    - You MUST output valid HTML ONLY.
    - Use Tailwind CSS for ALL styling
    - Include this EXACT script in the <head>: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    - Use Tailwind utility classes extensively for styling, animations, and responsiveness
    - Make it fully functional and interactive with JavaScript in <script> tag before closing </body>
    - Use modern, beautiful design with great UX using Tailwind classes
    - Make it responsive using Tailwind responsive classes (sm:, md:, lg:, xl:)
    - Use Tailwind animations and transitions (animate-*, transition-*)
    - Include all necessary meta tags
    - Use Google Fonts CDN if needed for custom fonts
    - Use placeholder images from https://placehold.co/600x400
    - Use Tailwind gradient classes for beautiful backgrounds
    - Make sure all buttons, cards, and components use Tailwind styling

CRITICAL HARD RULES:
    1. You MUST put ALL output ONLY into message.content.
    2. You MUST NOT place anything in "reasoning", "analysis", "reasoning_details", or any hidden fields.
    3. You MUST NOT include internal thoughts, explanations, analysis, comments, or markdown.
    4. Do NOT include markdown, explanations, notes, or code fences.

The HTML should be complete and ready to render as-is with Tailwind CSS.`,
                },
                { role: 'user', content: enhancedPrompt },
            ],
        });

        let rawCode = '';
        let reasoningChars = 0;
        let finishReason = '';
        for await (const part of stream) {
            const choice = part.choices[0];
            // Certains modeles renvoient leur texte dans `reasoning` au lieu de
            // `content`. On le compte pour pouvoir diagnostiquer une sortie vide.
            reasoningChars += ((choice?.delta as any)?.reasoning || '').length;
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta = choice?.delta?.content || '';
            if (delta) {
                rawCode += delta;
                send('chunk', { delta });
            }
        }

        const code = cleanCode(rawCode);

        // Sans ce garde-fou, une reponse vide etait enregistree comme une
        // version valide : le projet paraissait genere et l'apercu restait blanc.
        if (!code) {
            throw new Error(
                reasoningChars > 0
                    ? `Le modele ${AI_MODEL} a mis ses ${reasoningChars} caracteres dans le champ "reasoning" et rien dans "content". Change AI_MODEL dans server/.env pour un modele sans raisonnement.`
                    : `Le modele ${AI_MODEL} n'a rien renvoye (finish_reason: ${finishReason || 'inconnu'}).`
            );
        }
        if (finishReason === 'length') {
            console.log(`[generate] sortie tronquee (${code.length} caracteres), le modele a atteint sa limite de tokens`);
        }

        // Persist the first version and update the project
        const version = await prisma.version.create({
            data: { code, description: 'Initial version', projectId: project.id },
        });

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've created your website! You can now preview it and request any changes.",
                projectId: project.id,
            },
        });

        await prisma.websiteProject.update({
            where: { id: project.id },
            data: { current_code: code, current_version_index: version.id },
        });

        send('done', { projectId: project.id, versionId: version.id });
    } catch (error: any) {
        // Refund the credits if generation failed
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: PROJECT_CREATION_COST } },
        }).catch(() => {});
        // Le corps de la reponse OpenRouter porte la vraie cause (cle invalide,
        // quota epuise, modele indisponible pour ta data policy).
        console.log('[generate] echec:', error.status || '', error.message);
        if (error.error || error.response?.data) {
            console.log('[generate] reponse du fournisseur:', JSON.stringify(error.error || error.response?.data));
        }
        send('error', { message: error.message });
    } finally {
        generatingProjects.delete(projectId);
        res.end();
    }
};

// ----------------------------------------------------------------------------
// Get a single user project (with conversation + versions)
// ----------------------------------------------------------------------------
export const getUserProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { projectId } = req.params as Record<string, string>;

        const project = await prisma.websiteProject.findFirst({
            where: {
                id: projectId,
                userId,
            },
            include: {
                conversation: {
                    orderBy: { timestamp: 'asc' },
                },
                versions: {
                    orderBy: { timestamp: 'asc' },
                },
            },
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({ project });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Get all projects for the current user
// ----------------------------------------------------------------------------
export const getUserProjects = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const projects = await prisma.websiteProject.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({ projects });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Save the current (manually edited) code of a project as a new version
// ----------------------------------------------------------------------------
export const saveProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { projectId } = req.params as Record<string, string>;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ message: 'code is required' });
        }

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const version = await prisma.version.create({
            data: { code, description: 'Manual save', projectId: project.id },
        });

        const updated = await prisma.websiteProject.update({
            where: { id: project.id },
            data: { current_code: code, current_version_index: version.id },
        });

        res.json({ project: updated });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Delete a project (and its related rows via cascade)
// ----------------------------------------------------------------------------
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { projectId } = req.params as Record<string, string>;

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        await prisma.websiteProject.delete({ where: { id: project.id } });

        res.json({ success: true });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Toggle whether a project is published
// ----------------------------------------------------------------------------
export const togglePublish = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { projectId } = req.params as Record<string, string>;

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const updated = await prisma.websiteProject.update({
            where: { id: project.id },
            data: { isPublished: !project.isPublished },
        });

        res.json({ isPublished: updated.isPublished });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Purchase credits — creates a Stripe Checkout session.
// A pending transaction is recorded now; credits are only granted once the
// Stripe webhook confirms the payment (see stripeController.stripeWebhook).
// ----------------------------------------------------------------------------
export const purchaseCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { planId } = req.body;
        const plan = CREDIT_PLANS[planId];

        if (!plan) {
            return res.status(400).json({ message: 'Invalid plan' });
        }

        // Record a pending transaction
        const transaction = await prisma.transaction.create({
            data: {
                planId,
                amount: plan.amount,
                credits: plan.credits,
                userId,
                isPaid: false,
            },
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

        // Create the Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${plan.credits} credits (${planId} plan)`,
                        },
                        unit_amount: Math.round(plan.amount * 100), // cents
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                transactionId: transaction.id,
                userId,
                credits: String(plan.credits),
            },
            success_url: `${clientUrl}/settings?payment=success`,
            cancel_url: `${clientUrl}/pricing?payment=cancel`,
        });

        res.json({ url: session.url });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
