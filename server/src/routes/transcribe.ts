import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/whisper.js';
import { createApiError } from '../middleware/errorHandler.js';

const upload = multer({ storage: multer.memoryStorage() });
export const transcribeRouter = Router();

transcribeRouter.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createApiError('No audio file provided', 400, 'VALIDATION_ERROR');
    }

    const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (err) {
    next(err);
  }
});
