import { Router } from 'express';
import { generateImage, type GeneratedImage } from '../services/gemini.js';
import { createApiError } from '../middleware/errorHandler.js';

export const generateRouter = Router();

generateRouter.post('/', async (req, res, next) => {
  try {
    const { conversationHistory, previousImage } = req.body as {
      conversationHistory: string[];
      previousImage?: GeneratedImage;
    };

    if (
      !conversationHistory ||
      !Array.isArray(conversationHistory) ||
      conversationHistory.length === 0
    ) {
      throw createApiError(
        'conversationHistory array is required',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (!conversationHistory.every((entry) => typeof entry === 'string')) {
      throw createApiError(
        'conversationHistory entries must be strings',
        400,
        'VALIDATION_ERROR',
      );
    }

    const image = await generateImage(conversationHistory, previousImage);
    res.json(image);
  } catch (err) {
    next(err);
  }
});
