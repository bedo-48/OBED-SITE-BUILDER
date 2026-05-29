import express from 'express';
import { getUserCredits, createUserProject, generateProject, purchaseCredits, getUserProject, getUserProjects, togglePublish, saveProject, deleteProject, getMe, updateProfile, deleteAccount } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const userRouter = express.Router();

userRouter.get('/me', protect, getMe);
userRouter.post('/update-profile', protect, updateProfile);
userRouter.delete('/account', protect, deleteAccount);
userRouter.get('/credits', protect, getUserCredits);
userRouter.post('/project', protect, createUserProject);
userRouter.post('/project/:projectId/generate', protect, generateProject);
userRouter.get('/project/:projectId', protect, getUserProject);
userRouter.get('/projects', protect, getUserProjects);
userRouter.post('/project/:projectId/save', protect, saveProject);
userRouter.delete('/project/:projectId', protect, deleteProject);
userRouter.get('/publish-toggle/:projectId', protect, togglePublish);
userRouter.post('/purchase-credits', protect, purchaseCredits);

export default userRouter;

