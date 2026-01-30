import type { GeneratedImage, TranscriptEntry } from '../types';

const SESSION_KEY = 'image-dreamer-session';

export interface SessionState {
  image: GeneratedImage | null;
  transcripts: TranscriptEntry[];
  history: string[];
}

export function saveSession(state: SessionState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Silently fail — quota exceeded or private browsing
  }
}

export function loadSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (
      !parsed ||
      !Array.isArray(parsed.transcripts) ||
      !Array.isArray(parsed.history)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
