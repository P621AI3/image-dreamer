import { Router } from 'express';
import { generateVideo, editVideo } from '../services/veo.js';
import { createApiError } from '../middleware/errorHandler.js';

export const videoRouter = Router();

videoRouter.post('/generate', async (req, res, next) => {
  try {
    const { prompt, sourceImage } = req.body as {
      prompt: string;
      sourceImage: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      throw createApiError('prompt is required', 400, 'VALIDATION_ERROR');
    }
    if (!sourceImage || typeof sourceImage !== 'string') {
      throw createApiError('sourceImage is required', 400, 'VALIDATION_ERROR');
    }

    console.log(
      `[video] generate request — prompt length: ${prompt.length}, image size: ${(sourceImage.length / 1024).toFixed(0)}KB`,
    );
    const video = await generateVideo(prompt, sourceImage);
    res.json(video);
  } catch (err) {
    next(err);
  }
});

videoRouter.post('/edit', async (req, res, next) => {
  try {
    const { editPrompt, videoBase64, sourceImage } = req.body as {
      editPrompt: string;
      videoBase64: string;
      sourceImage: string;
    };

    if (!editPrompt || typeof editPrompt !== 'string') {
      throw createApiError('editPrompt is required', 400, 'VALIDATION_ERROR');
    }
    if (!videoBase64 || typeof videoBase64 !== 'string') {
      throw createApiError('videoBase64 is required', 400, 'VALIDATION_ERROR');
    }
    if (!sourceImage || typeof sourceImage !== 'string') {
      throw createApiError('sourceImage is required', 400, 'VALIDATION_ERROR');
    }

    console.log(
      `[video] edit request — prompt length: ${editPrompt.length}, video size: ${(videoBase64.length / 1024).toFixed(0)}KB, image size: ${(sourceImage.length / 1024).toFixed(0)}KB`,
    );
    const video = await editVideo(editPrompt, videoBase64, sourceImage);
    res.json(video);
  } catch (err) {
    next(err);
  }
});
