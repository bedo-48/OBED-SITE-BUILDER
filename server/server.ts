import "dotenv/config";
import express, { Request, Response } from 'express';
import cors from "cors";
import 'dotenv/config';


const app = express();

// Middleware
app.use(cors())
app.use(express.json());

const port =  3000;

const corsOptions = {
    origin: process.env.TRUSTED_ORIGINS?.split(',') || [],
    credentials: true,

}

app.use(cors(corsOptions))

app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});