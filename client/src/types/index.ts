export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export interface GeneratedVideo {
  base64: string;
  mimeType: string;
}

export type AppMode = 'image' | 'video';

export interface GalleryItem {
  id: string;
  image: GeneratedImage;
  savedAt: number;
  label?: string;
}

export type AppState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'generating'
  | 'generating-video'
  | 'editing-video'
  | 'error';

export type ErrorCategory =
  | 'transcription'
  | 'generation'
  | 'video-generation'
  | 'network'
  | 'microphone'
  | 'unknown';

export class AppError extends Error {
  category: ErrorCategory;
  serverCode?: string;

  constructor(message: string, category: ErrorCategory, serverCode?: string) {
    super(message);
    this.category = category;
    this.serverCode = serverCode;
  }
}
