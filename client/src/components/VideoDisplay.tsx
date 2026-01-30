import { useEffect, useRef } from 'react';
import type { GeneratedVideo, AppState } from '../types';
import { downloadVideo } from '../services/imageUtils';

interface VideoDisplayProps {
  video: GeneratedVideo;
  appState: AppState;
  onSwitchToImage: () => void;
}

const EDITING_MESSAGES = [
  'Reshaping the scene\u2026',
  'Reweaving the motion\u2026',
  'Reimagining the sequence\u2026',
  'Transforming the footage\u2026',
];

const TRANSCRIBING_MESSAGES = [
  'Listening to your direction\u2026',
  'Catching your edit notes\u2026',
  'Hearing your vision\u2026',
];

function pickMessage(messages: string[], seed: number): string {
  return messages[seed % messages.length];
}

export function VideoDisplay({
  video,
  appState,
  onSwitchToImage,
}: VideoDisplayProps) {
  const isEditing = appState === 'editing-video';
  const isTranscribing = appState === 'transcribing';
  const videoSrc = `data:${video.mimeType};base64,${video.base64}`;

  const messageSeedRef = useRef(0);
  const prevAppStateRef = useRef<AppState>('idle');

  useEffect(() => {
    const isNowActive =
      appState === 'editing-video' || appState === 'transcribing';
    const wasActive =
      prevAppStateRef.current === 'editing-video' ||
      prevAppStateRef.current === 'transcribing';
    if (isNowActive && !wasActive) {
      messageSeedRef.current = Math.floor(Math.random() * 100);
    }
    prevAppStateRef.current = appState;
  }, [appState]);

  const seed = messageSeedRef.current;
  let status: string | null = null;
  if (isEditing) {
    status = pickMessage(EDITING_MESSAGES, seed);
  } else if (isTranscribing) {
    status = pickMessage(TRANSCRIBING_MESSAGES, seed);
  }

  const videoClassName = ['generated-video', isEditing ? 'video-loading' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="video-display">
      <div className="video-actions">
        <button
          className="image-action-btn"
          onClick={() => downloadVideo(video)}
          aria-label="Download video"
          title="Download"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </button>
        <button
          className="image-action-btn"
          onClick={onSwitchToImage}
          aria-label="Back to image"
          title="Back to image"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
          </svg>
        </button>
      </div>

      <video className={videoClassName} src={videoSrc} controls autoPlay loop />

      {status && (
        <div className="status-overlay">
          <p className="status-text">{status}</p>
        </div>
      )}
    </div>
  );
}
