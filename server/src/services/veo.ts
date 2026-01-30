import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { createApiError } from '../middleware/errorHandler.js';

export interface GeneratedVideo {
  base64: string;
  mimeType: string;
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
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

  return cachedClient;
}

export async function generateVideo(
  prompt: string,
  sourceImage: string,
): Promise<GeneratedVideo> {
  const client = getClient();

  let operation;
  try {
    operation = await client.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      image: {
        imageBytes: sourceImage,
        mimeType: 'image/png',
      },
      config: {
        aspectRatio: '16:9',
        numberOfVideos: 1,
        durationSeconds: 8,
        generateAudio: true,
      },
    });
  } catch (err) {
    console.error('[veo] generateVideos call failed', err);
    throw createApiError(
      'Failed to start video generation -- please try again',
      502,
      'VIDEO_GENERATION_FAILED',
    );
  }

  // Poll until done
  const POLL_INTERVAL = 10_000;
  const POLL_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  const MAX_POLLS = Math.ceil(POLL_TIMEOUT / POLL_INTERVAL);
  let polls = 0;
  const pollStart = Date.now();

  while (!operation.done) {
    if (polls >= MAX_POLLS) {
      const elapsed = ((Date.now() - pollStart) / 1000).toFixed(0);
      console.error(
        `[veo] poll timed out after ${elapsed}s (${polls} attempts)`,
      );
      throw createApiError(
        'Video generation timed out -- the AI took too long, try again',
        504,
        'VIDEO_GENERATION_FAILED',
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    try {
      operation = await client.operations.getVideosOperation({
        operation: operation,
      });
    } catch (err) {
      const elapsed = ((Date.now() - pollStart) / 1000).toFixed(0);
      console.error(
        `[veo] poll failed at attempt ${polls + 1} (${elapsed}s elapsed)`,
        err,
      );
      throw createApiError(
        'Lost connection while generating video -- please try again',
        502,
        'VIDEO_GENERATION_FAILED',
      );
    }
    polls++;
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video?.uri) {
    console.error(
      '[veo] No video in response',
      JSON.stringify(operation.response, null, 2),
    );
    throw createApiError(
      'No video was produced -- try a different prompt',
      502,
      'VIDEO_GENERATION_FAILED',
    );
  }

  // Download to temp file and read as base64
  const tmpFile = path.join(os.tmpdir(), `veo-${Date.now()}.mp4`);
  try {
    await client.files.download({
      file: generatedVideo.video.uri,
      downloadPath: tmpFile,
    });
    const buffer = fs.readFileSync(tmpFile);
    return { base64: buffer.toString('base64'), mimeType: 'video/mp4' };
  } catch (err) {
    console.error('[veo] download failed', err);
    throw createApiError(
      'Video was created but download failed -- please try again',
      502,
      'VIDEO_GENERATION_FAILED',
    );
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (cleanupErr) {
      console.warn('[veo] failed to clean up temp file', tmpFile, cleanupErr);
    }
  }
}

export async function editVideo(
  editPrompt: string,
  videoBase64: string,
  sourceImage: string,
): Promise<GeneratedVideo> {
  const client = getClient();

  // Write video to temp file and upload
  const tmpFile = path.join(os.tmpdir(), `veo-edit-${Date.now()}.mp4`);
  let uploadedFileName: string;
  let uploadedFileUri: string;

  try {
    fs.writeFileSync(tmpFile, Buffer.from(videoBase64, 'base64'));
    const uploaded = await client.files.upload({
      file: tmpFile,
      config: { mimeType: 'video/mp4' },
    });
    if (!uploaded.name || !uploaded.uri) {
      throw new Error('No name/URI returned from file upload');
    }
    uploadedFileName = uploaded.name;
    uploadedFileUri = uploaded.uri;
  } catch (err) {
    console.error('[veo] upload failed', err);
    throw createApiError(
      'Failed to upload video for editing -- please try again',
      502,
      'VIDEO_GENERATION_FAILED',
    );
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (cleanupErr) {
      console.warn('[veo] failed to clean up temp file', tmpFile, cleanupErr);
    }
  }

  // Wait for file to become ACTIVE
  const FILE_POLL_INTERVAL = 2_000;
  const FILE_POLL_TIMEOUT = 60_000;
  const FILE_MAX_POLLS = Math.ceil(FILE_POLL_TIMEOUT / FILE_POLL_INTERVAL);
  let filePoll = 0;
  while (filePoll < FILE_MAX_POLLS) {
    try {
      const fileInfo = await client.files.get({ name: uploadedFileName });
      if (fileInfo.state === 'ACTIVE') break;
      if (fileInfo.state === 'FAILED') {
        console.error('[veo] uploaded file entered FAILED state');
        throw createApiError(
          'Video file processing failed -- try a different video',
          502,
          'VIDEO_GENERATION_FAILED',
        );
      }
    } catch (err) {
      // Re-throw our own ApiErrors
      if (err && typeof err === 'object' && 'statusCode' in err) throw err;
      console.error('[veo] file status check failed', err);
    }
    await new Promise((r) => setTimeout(r, FILE_POLL_INTERVAL));
    filePoll++;
  }

  // Use Gemini to describe the current video
  let description: string;
  try {
    const describeResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: uploadedFileUri,
                mimeType: 'video/mp4',
              },
            },
            {
              text: 'Describe this video in detail: the scene, objects, colors, movement, camera angle, lighting, and mood. Be specific and thorough.',
            },
          ],
        },
      ],
    });
    description = describeResponse.text ?? '';
  } catch (err) {
    console.error('[veo] describe failed', err);
    throw createApiError(
      'Failed to analyze video for editing -- please try again',
      502,
      'VIDEO_GENERATION_FAILED',
    );
  }

  // Combine description + edit prompt and regenerate
  const combinedPrompt = `Starting from a video that looks like this: ${description}\n\nApply the following edit: ${editPrompt}`;

  return generateVideo(combinedPrompt, sourceImage);
}
