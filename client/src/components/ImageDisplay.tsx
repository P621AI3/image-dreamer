import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeneratedImage, AppState } from '../types';
import {
  readFileAsGeneratedImage,
  downloadImage,
} from '../services/imageUtils';

interface ImageDisplayProps {
  image: GeneratedImage | null;
  appState: AppState;
  onImageUpload: (image: GeneratedImage) => void;
  onSaveToGallery: () => void;
  onGenerateVideo: () => void;
  isVideoGenerating: boolean;
  isImageSaved: boolean;
}

const TRANSCRIBING_MESSAGES = [
  'Listening to your words\u2026',
  'Catching your whispers\u2026',
  'Tuning into your thoughts\u2026',
  'Absorbing your ideas\u2026',
];

const GENERATING_FIRST_MESSAGES = [
  'Conjuring your first dream\u2026',
  'Painting your imagination\u2026',
  'Summoning pixels from the void\u2026',
  'Channeling creative energy\u2026',
];

const GENERATING_EVOLVE_MESSAGES = [
  'Evolving the dream\u2026',
  'Reshaping your vision\u2026',
  'Weaving new threads into the dream\u2026',
  'The dream shifts and transforms\u2026',
];

const GENERATING_VIDEO_MESSAGES = [
  'Bringing the dream to life\u2026',
  'Animating your imagination\u2026',
  'Spinning frames of wonder\u2026',
  'Breathing motion into the dream\u2026',
];

function pickMessage(messages: string[], seed: number): string {
  return messages[seed % messages.length];
}

export function ImageDisplay({
  image,
  appState,
  onImageUpload,
  onSaveToGallery,
  onGenerateVideo,
  isVideoGenerating,
  isImageSaved,
}: ImageDisplayProps) {
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSavedFlash, setShowSavedFlash] = useState(false);
  const prevImageRef = useRef<GeneratedImage | null>(null);
  const dragCounterRef = useRef(0);
  // Seed for picking fun messages — changes each time we enter a new processing state
  const messageSeedRef = useRef(0);
  const prevAppStateRef = useRef<AppState>('idle');

  // Pick a new seed when entering a processing state
  useEffect(() => {
    const isNowProcessing =
      appState === 'transcribing' ||
      appState === 'generating' ||
      appState === 'generating-video';
    const wasProcessing =
      prevAppStateRef.current === 'transcribing' ||
      prevAppStateRef.current === 'generating' ||
      prevAppStateRef.current === 'generating-video';
    if (isNowProcessing && !wasProcessing) {
      messageSeedRef.current = Math.floor(Math.random() * 100);
    }
    prevAppStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    if (!image) {
      setDisplayedSrc(null);
      prevImageRef.current = null;
      return;
    }

    const newSrc = `data:${image.mimeType};base64,${image.base64}`;

    // First image — show immediately
    if (!prevImageRef.current) {
      setDisplayedSrc(newSrc);
      prevImageRef.current = image;
      return;
    }

    // Subsequent images — brief crossfade
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayedSrc(newSrc);
      prevImageRef.current = image;
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [image]);

  // Flash the saved indicator briefly when isImageSaved transitions to true
  useEffect(() => {
    if (isImageSaved) {
      setShowSavedFlash(true);
      const timer = setTimeout(() => setShowSavedFlash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [isImageSaved]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;

      try {
        const result = await readFileAsGeneratedImage(file);
        onImageUpload(result);
      } catch (err) {
        console.error('[ImageDisplay] failed to read dropped file', err);
      }
    },
    [onImageUpload],
  );

  const hasImage = displayedSrc !== null;
  const isProcessing =
    appState === 'transcribing' ||
    appState === 'generating' ||
    appState === 'generating-video';
  const showSpinner = isProcessing && !hasImage;
  const showBlur = isProcessing && hasImage;

  const seed = messageSeedRef.current;
  let status: string | null = null;
  switch (appState) {
    case 'transcribing':
      status = pickMessage(TRANSCRIBING_MESSAGES, seed);
      break;
    case 'generating':
      status = hasImage
        ? pickMessage(GENERATING_EVOLVE_MESSAGES, seed)
        : pickMessage(GENERATING_FIRST_MESSAGES, seed);
      break;
    case 'generating-video':
      status = pickMessage(GENERATING_VIDEO_MESSAGES, seed);
      break;
  }

  const containerClassName = ['image-display', isDragging ? 'drag-active' : '']
    .filter(Boolean)
    .join(' ');

  const imageClassName = [
    'generated-image',
    showBlur ? 'image-loading' : '',
    isTransitioning ? 'image-transitioning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const saveButtonClassName = [
    'image-action-btn',
    isImageSaved ? 'saved' : '',
    showSavedFlash ? 'save-flash' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClassName}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-overlay">
          <p>Drop image to start dreaming</p>
        </div>
      )}

      {showSpinner && (
        <div className="spinner-overlay">
          <div className="spinner" />
          {status && <p className="status-text">{status}</p>}
        </div>
      )}

      {hasImage && (
        <div className="image-actions">
          <button
            className="image-action-btn"
            onClick={onGenerateVideo}
            disabled={isVideoGenerating}
            aria-label="Generate video"
            title="Generate video"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M4 6.47L5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4z" />
            </svg>
          </button>
          <button
            className="image-action-btn"
            onClick={() => downloadImage(image!)}
            aria-label="Download image"
            title="Download"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          </button>
          <button
            className={saveButtonClassName}
            onClick={onSaveToGallery}
            disabled={isImageSaved}
            aria-label={isImageSaved ? 'Saved to gallery' : 'Save to gallery'}
            title={isImageSaved ? 'Saved!' : 'Save to gallery'}
          >
            {isImageSaved ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {hasImage ? (
        <>
          <img
            src={displayedSrc}
            alt="Generated dream"
            className={imageClassName}
          />
          {showBlur && status && (
            <div className="status-overlay">
              <p className="status-text">{status}</p>
            </div>
          )}
        </>
      ) : (
        !isProcessing && (
          <div className="image-placeholder">
            <p>Speak or drop an image to start dreaming</p>
          </div>
        )
      )}
    </div>
  );
}
