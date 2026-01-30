import OpenAI from 'openai';
import { createApiError } from '../middleware/errorHandler.js';

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw createApiError(
      'OPENAI_API_KEY is not configured',
      500,
      'CONFIG_ERROR',
    );
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimetype: string,
): Promise<string> {
  const client = getClient();

  const ext = mimetype.includes('webm') ? 'webm' : 'wav';
  const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, {
    type: mimetype,
  });

  try {
    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
    });

    return response.text;
  } catch (err) {
    console.error('[whisper]', err);
    throw createApiError(
      'Audio transcription failed',
      502,
      'TRANSCRIPTION_FAILED',
    );
  }
}
