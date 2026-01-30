import { useCallback, useRef } from 'react';
import type { GeneratedImage } from '../types';
import { readFileAsGeneratedImage } from '../services/imageUtils';

interface VoiceInputProps {
  isRecording: boolean;
  volumeLevels: number[];
  onToggle: () => void;
  onUpload: (image: GeneratedImage) => void;
  onGalleryClick: () => void;
}

export function VoiceInput({
  isRecording,
  volumeLevels,
  onToggle,
  onUpload,
  onGalleryClick,
}: VoiceInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const result = await readFileAsGeneratedImage(file);
        onUpload(result);
      } catch (err) {
        console.error('[VoiceInput] failed to read uploaded file', err);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onUpload],
  );

  return (
    <div className="voice-input">
      <div className="waveform">
        {isRecording &&
          volumeLevels.map((level, i) => (
            <div
              key={i}
              className="waveform-bar"
              style={{ height: `${Math.max(4, level * 48)}px` }}
            />
          ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button
        className="control-btn"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload image"
        title="Upload image"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
        </svg>
      </button>

      <button
        className={`mic-button ${isRecording ? 'mic-active' : ''}`}
        onClick={onToggle}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          {isRecording ? (
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            <>
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </>
          )}
        </svg>
      </button>

      <button
        className="control-btn"
        onClick={onGalleryClick}
        aria-label="Open gallery"
        title="Gallery"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
        </svg>
      </button>

      <div className="waveform">
        {isRecording &&
          volumeLevels
            .slice()
            .reverse()
            .map((level, i) => (
              <div
                key={i}
                className="waveform-bar"
                style={{ height: `${Math.max(4, level * 48)}px` }}
              />
            ))}
      </div>
    </div>
  );
}
