import express from 'express';
import {
    makeRevision,
    rollbackVersion,
    getPublishedProjects,
    getPublishedProject,
} from '../controllers/projectController.js';
import { protect } from '../middlewares/auth.js';

const projectRouter = express.Router();

// Public routes (no auth) — used by the Community and View pages
projectRouter.get('/published', getPublishedProjects);
projectRouter.get('/published/:projectId', getPublishedProject);

// Protected routes
projectRouter.post('/:projectId/revision', protect, makeRevision);
projectRouter.post('/:projectId/rollback/:versionId', protect, rollbackVersion);

export default projectRouter;
