import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import userRouter from "./routes/userRoute";
import projectRouter from "./routes/projectRoutes";
import { stripeWebhook } from "./controllers/stripeController";

const app = express();
const port = 3000;

// CORS (must allow credentials so auth cookies are sent)
const corsOptions = {
    origin: process.env.TRUSTED_ORIGINS?.split(',') || [],
    credentials: true,
};
app.use(cors(corsOptions));

// IMPORTANT: register the better-auth handler BEFORE express.json().
// better-auth needs the raw request body, so the JSON parser must come after.
app.all('/api/auth/{*any}', toNodeHandler(auth));

// Stripe webhook needs the RAW body for signature verification,
// so it must be registered BEFORE express.json().
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// JSON body parser for the rest of the API (large limit for generated HTML)
app.use(express.json({ limit: '50mb' }));

app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});

app.use('/api/user', userRouter);
app.use('/api/project', projectRouter);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
