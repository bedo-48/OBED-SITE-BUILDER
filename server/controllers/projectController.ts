import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { aiChat, AI_MODEL, AI_MODELS } from '../configs/openai.js';

const REVISION_COST = 5;

const cleanCode = (raw: string) =>
    raw.replace(/```[a-z]*\n/gi, '').replace(/```$/g, '').trim();

// ----------------------------------------------------------------------------
// Make a revision to an existing project
// ----------------------------------------------------------------------------
export const makeRevision = async (req: Request, res: Response) => {
    const userId = req.userId;
    try {
        const { projectId } = req.params as Record<string, string>;
        const { message } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!message) {
            return res.status(400).json({ message: 'message is required' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.credits < REVISION_COST) {
            return res.status(403).json({ message: 'Add credits to make more revisions' });
        }

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Deduct credits and store the user's request
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: REVISION_COST } },
        });

        await prisma.conversation.create({
            data: { role: 'user', content: message, projectId: project.id },
        });

        // ---- Step 1: enhance the revision request ----
        const enhanceResponse = await aiChat({
            // modele et fallbacks: AI_MODELS
            messages: [
                {
                    role: 'system',
                    content: `You are a prompt enhancement specialist. The user wants to make changes to their website. Enhance their request to be more specific and actionable for a web developer.

Enhance this by:
    1. Being specific about what elements to change
    2. Mentioning design details (colors, spacing, sizes)
    3. Clarifying the desired outcome
    4. Using clear technical terms

Return ONLY the enhanced request, nothing else. Keep it concise (1-2 sentences).`,
                },
                { role: 'user', content: message },
            ],
        });

        const enhancedRequest = enhanceResponse.choices[0].message.content || message;

        // ---- Step 2: generate the updated website code ----
        const generationResponse = await aiChat({
            // modele et fallbacks: AI_MODELS
            messages: [
                {
                    role: 'system',
                    content: `You are an expert web developer.

CRITICAL REQUIREMENTS:
    - Return ONLY the complete updated HTML code with the requested changes.
    - Use Tailwind CSS for ALL styling (NO custom CSS).
    - Use Tailwind utility classes for all styling changes.
    - Include all JavaScript in <script> tags before closing </body>
    - Make sure it's a complete, standalone HTML document with Tailwind CSS
    - Return the HTML Code Only, nothing else

Apply the requested changes while maintaining the Tailwind CSS styling approach.`,
                },
                {
                    role: 'user',
                    content: `Here is the current website code:\n\n${project.current_code || ''}\n\nApply this change: ${enhancedRequest}`,
                },
            ],
        });

        const revisionMessage = generationResponse.choices[0].message as any;
        const code = cleanCode(revisionMessage?.content || '');

        // Une reponse vide ecrasait la version precedente par du vide.
        if (!code) {
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: REVISION_COST } },
            }).catch(() => {});
            return res.status(502).json({
                message: revisionMessage?.reasoning
                    ? `Le modele ${AI_MODEL} a repondu dans "reasoning" au lieu de "content". Change AI_MODEL dans server/.env.`
                    : `Le modele ${AI_MODEL} n'a rien renvoye.`,
            });
        }

        // Save the new version and update the project
        const version = await prisma.version.create({
            data: {
                code,
                description: message.length > 60 ? message.substring(0, 57) + '...' : message,
                projectId: project.id,
            },
        });

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've updated your website with the requested changes.",
                projectId: project.id,
            },
        });

        await prisma.websiteProject.update({
            where: { id: project.id },
            data: { current_code: code, current_version_index: version.id },
        });

        // Return the full updated project so the UI can refresh
        const updatedProject = await prisma.websiteProject.findFirst({
            where: { id: project.id },
            include: {
                conversation: { orderBy: { timestamp: 'asc' } },
                versions: { orderBy: { timestamp: 'asc' } },
            },
        });

        res.json({ project: updatedProject });
    } catch (error: any) {
        // Refund credits on failure
        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: REVISION_COST } },
            }).catch(() => {});
        }
        console.log(error);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};

// ----------------------------------------------------------------------------
// Roll back a project to a previous version
// ----------------------------------------------------------------------------
export const rollbackVersion = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { projectId, versionId } = req.params as Record<string, string>;

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId },
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const version = await prisma.version.findFirst({
            where: { id: versionId, projectId },
        });
        if (!version) {
            return res.status(404).json({ message: 'Version not found' });
        }

        const updated = await prisma.websiteProject.update({
            where: { id: project.id },
            data: { current_code: version.code, current_version_index: version.id },
        });

        res.json({ project: updated });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Public: list all published projects (community page)
// ----------------------------------------------------------------------------
export const getPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.websiteProject.findMany({
            where: { isPublished: true },
            orderBy: { updatedAt: 'desc' },
            include: { user: { select: { name: true } } },
        });

        res.json({ projects });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------------------------------
// Public: get a single published project (view page)
// ----------------------------------------------------------------------------
export const getPublishedProject = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params as Record<string, string>;

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, isPublished: true },
            include: { user: { select: { name: true } } },
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found or not published' });
        }

        res.json({ project });
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
