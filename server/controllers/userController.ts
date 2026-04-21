import { Request, Response } from 'express';  
import prisma from '../lib/prisma.js';  
import openai from '../configs/openai.js';

// get useer credits

export const getUserCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if(!userId){
            return res.status(401).json({message: 'Unauthorized'});

        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
          
        })

        res.json({ credits: user?.credits });

} catch (error:any) {

    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });


}
}


// controller function to create a new project 

export const createUserProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    try {
        
        const {initial_prompt} = req.body;
        if(!userId){
            return res.status(401).json({message: 'Unauthorized'});

        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
          
        })

        if(user && user.credits < 5 ){
            return res.status(403).json({message: 'Add creditsto create more projects'});   

        }
        // create a new project

        const project = await prisma.websiteProject.create({
            data: {
                name: initial_prompt > 50? initial_prompt.substring(0, 47) + '...' : initial_prompt, 

                initial_prompt,
                userId
        }
    })

    // update user credits

        await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                totalCreation: {incremenent: 1},
            }
        })

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: initial_prompt,
                projectId: project.id,
               
            }
        })

        await prisma.user.update({
            where: {
                id: userId  },
            data: {
                credits: { decrement: 5 },
            }
        })



        res.json({ projectId: project.id})

        // Enhance user prompt

        const promptEnhanceResponse = await openai

} catch (error:any) {

    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });


}
}
