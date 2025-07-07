import express from 'express';
import { getAllIntents } from '../controllers/intentsController.js';

const router = express.Router();

router.get('/intents', getAllIntents);

export default router;