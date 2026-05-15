

import express from 'express';

import { getUserCredits, createUserProject, purchaseCredits, getUserProject, getUserProjects, togglePublish } from '../controllers/userController.js';

import {protect} from '../middlewares/auth.js'
import { get } from 'node:http';

const userRouter = express.Router();

userRouter.get('/credits', protect,  getUserCredits);
userRouter.post('/project', protect, createUserProject);
userRouter.get('/project/:projectId', protect, getUserProject);
userRouter.get('/projects', protect, getUserProjects);
userRouter.get('/publish-toggle/:projectId', protect, togglePublish);
userRouter.post('/purchase-credits', protect, purchaseCredits);

export default userRouter;

