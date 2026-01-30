import type { GeneratedImage, GeneratedVideo, ErrorCategory } from '../types';
import { AppError } from '../types';

function serverCodeToCategory(code: string | undefined): ErrorCategory | null {
  switch (code) {
    case 'TRANSCRIPTION_FAILED':
      return 'transcription';
    case 'GENERATION_FAILED':
      return 'generation';
    case 'VIDEO_GENERATION_FAILED':
      return 'video-generation';
    case 'VALIDATION_ERROR':
    case 'CONFIG_ERROR':
    case 'INTERNAL_ERROR':
      return null; // use the fallback
    default:
      return null;
  }
}

async function parseErrorResponse(
  res: Response,
  fallbackCategory: ErrorCategory,
): Promise<AppError> {
  let body: { error?: string; code?: string } = {};
  try {
    body = await res.json();
  } catch {
    console.warn('[api] Failed to parse error response JSON');
  }

  const category = serverCodeToCategory(body.code) ?? fallbackCategory;
  const message = body.error || `Request failed (${res.status})`;

  return new AppError(message, category, body.code);
}

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  );
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  let res: Response;
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      console.error('[api] Transcription timed out', err);
      throw new AppError(
        'Transcription took too long -- try speaking again',
        'transcription',
      );
    }
    console.error('[api] Network error during transcription', err);
    throw new AppError('Network error -- could not reach server', 'network');
  }

  if (!res.ok) {
    throw await parseErrorResponse(res, 'transcription');
  }

  const data: { text: string } = await res.json();
  return data.text;
}

export async function generateImage(
  conversationHistory: string[],
  previousImage?: GeneratedImage | null,
): Promise<GeneratedImage> {
  const body: {
    conversationHistory: string[];
    previousImage?: { base64: string; mimeType: string };
  } = {
    conversationHistory,
  };
  if (previousImage) {
    body.previousImage = {
      base64: previousImage.base64,
      mimeType: previousImage.mimeType,
    };
  }

  let res: Response;
  try {
    res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      console.error('[api] Image generation timed out', err);
      throw new AppError(
        'Image generation took too long -- try again',
        'generation',
      );
    }
    console.error('[api] Network error during image generation', err);
    throw new AppError('Network error -- could not reach server', 'network');
  }

  if (!res.ok) {
    throw await parseErrorResponse(res, 'generation');
  }

  return res.json();
}

export async function generateVideo(
  prompt: string,
  sourceImage: string,
): Promise<GeneratedVideo> {
  let res: Response;
  try {
    res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sourceImage }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      console.error('[api] Video generation timed out', err);
      throw new AppError(
        'Video generation timed out -- try again',
        'video-generation',
      );
    }
    console.error('[api] Network error during video generation', err);
    throw new AppError('Network error -- could not reach server', 'network');
  }

  if (!res.ok) {
    throw await parseErrorResponse(res, 'video-generation');
  }

  return res.json();
}

export async function editVideo(
  editPrompt: string,
  videoBase64: string,
  sourceImage: string,
): Promise<GeneratedVideo> {
  let res: Response;
  try {
    res = await fetch('/api/video/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editPrompt, videoBase64, sourceImage }),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      console.error('[api] Video editing timed out', err);
      throw new AppError(
        'Video editing timed out -- try again',
        'video-generation',
      );
    }
    console.error('[api] Network error during video editing', err);
    throw new AppError('Network error -- could not reach server', 'network');
  }

  if (!res.ok) {
    throw await parseErrorResponse(res, 'video-generation');
  }

  return res.json();
}
