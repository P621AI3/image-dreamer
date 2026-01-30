import { GoogleGenAI } from '@google/genai';
import { createApiError } from '../middleware/errorHandler.js';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): { client: GoogleGenAI; modelName: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createApiError(
      'GEMINI_API_KEY is not configured',
      500,
      'CONFIG_ERROR',
    );
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';

  return { client: cachedClient, modelName };
}

// Retry-eligible finish reasons (known transient failures from Gemini image gen)
const RETRYABLE_FINISH_REASONS = new Set(['OTHER', 'IMAGE_OTHER']);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function extractImage(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
}): GeneratedImage | null {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!parts || parts.length === 0) return null;

  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }
  return null;
}

export async function generateImage(
  conversationHistory: string[],
  previousImage?: GeneratedImage,
): Promise<GeneratedImage> {
  const { client, modelName } = getClient();

  let contents:
    | string
    | {
        role: string;
        parts: Array<{
          inlineData?: { mimeType: string; data: string };
          text?: string;
        }>;
      }[];

  if (previousImage) {
    const prompt = `Evolve this image based on the following description, maintaining the same visual style and composition: ${conversationHistory.join('. ')}`;
    contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: previousImage.mimeType,
              data: previousImage.base64,
            },
          },
          { text: prompt },
        ],
      },
    ];
  } else {
    contents = `Generate an image based on this evolving description: ${conversationHistory.join('. ')}`;
  }

  let lastFinishReason: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(
        `[gemini] retry ${attempt}/${MAX_RETRIES} after finishReason: ${lastFinishReason}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }

    let response;
    try {
      response = await client.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });
    } catch (err) {
      console.error(
        `[gemini] generateContent threw (attempt ${attempt + 1})`,
        err,
      );
      if (attempt < MAX_RETRIES) continue;
      throw createApiError(
        'Failed to generate image -- please try again',
        502,
        'GENERATION_FAILED',
      );
    }

    const image = extractImage(response);
    if (image) return image;

    const candidate = response.candidates?.[0];
    lastFinishReason = candidate?.finishReason ?? 'UNKNOWN';
    const parts = candidate?.content?.parts;

    // Safety block — don't retry
    if (
      lastFinishReason === 'SAFETY' ||
      lastFinishReason === 'IMAGE_SAFETY' ||
      lastFinishReason === 'IMAGE_PROHIBITED_CONTENT'
    ) {
      console.error(`[gemini] blocked by safety filter: ${lastFinishReason}`);
      throw createApiError(
        'Your prompt was blocked by safety filters -- try rephrasing',
        502,
        'GENERATION_FAILED',
      );
    }

    // Log text-only responses
    if (parts && parts.length > 0) {
      const textParts = parts.filter((p) => p.text).map((p) => p.text);
      if (textParts.length > 0) {
        console.error('[gemini] Got text-only response:', textParts.join(' '));
      }
    }

    // Retryable — loop again
    if (
      RETRYABLE_FINISH_REASONS.has(lastFinishReason) &&
      attempt < MAX_RETRIES
    ) {
      console.warn(
        `[gemini] empty response, finishReason: ${lastFinishReason} (attempt ${attempt + 1})`,
      );
      continue;
    }

    // Non-retryable or exhausted retries
    console.error(
      `[gemini] No image after ${attempt + 1} attempt(s). finishReason: ${lastFinishReason}`,
    );
    console.error(
      '[gemini] Full candidate:',
      JSON.stringify(candidate, null, 2),
    );
  }

  throw createApiError(
    'Image generation failed after multiple attempts -- the AI is being flaky, try again',
    502,
    'GENERATION_FAILED',
  );
}
