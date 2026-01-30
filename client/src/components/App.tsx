import { useCallback, useEffect, useState } from 'react';
import { useImageDreamer } from '../hooks/useImageDreamer';
import { useGallery } from '../hooks/useGallery';
import { ImageDisplay } from './ImageDisplay';
import { VideoDisplay } from './VideoDisplay';
import { VoiceInput } from './VoiceInput';
import { TranscriptHistory } from './TranscriptHistory';
import { Gallery } from './Gallery';
import { ErrorBoundary } from './ErrorBoundary';
import type { ErrorCategory, GeneratedImage } from '../types';

function errorLabel(category: ErrorCategory): string {
  switch (category) {
    case 'transcription':
      return 'Transcription error';
    case 'generation':
      return 'Generation error';
    case 'video-generation':
      return 'Video generation error';
    case 'network':
      return 'Network error';
    case 'microphone':
      return 'Microphone error';
    case 'unknown':
      return 'Error';
  }
}

export function App() {
  const {
    transcripts,
    image,
    video,
    mode,
    appState,
    error,
    isRecording,
    volumeLevels,
    start,
    stop,
    clearHistory,
    setExternalImage,
    dismissError,
    generateVideoFromImage,
    switchToImageMode,
  } = useImageDreamer();

  const gallery = useGallery();

  // Track whether the current image has been saved to the gallery
  const [isImageSaved, setIsImageSaved] = useState(false);

  // Reset saved state when the image changes
  useEffect(() => {
    setIsImageSaved(false);
  }, [image]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      start();
    }
  }, [isRecording, start, stop]);

  const handleImageUpload = useCallback(
    (img: GeneratedImage) => {
      setExternalImage(img);
    },
    [setExternalImage],
  );

  const handleGalleryLoad = useCallback(
    (img: GeneratedImage) => {
      setExternalImage(img);
      gallery.close();
    },
    [setExternalImage, gallery.close],
  );

  const handleSaveToGallery = useCallback(() => {
    if (image && !isImageSaved) {
      gallery.saveImage(image);
      setIsImageSaved(true);
    }
  }, [image, isImageSaved, gallery.saveImage]);

  const handleGenerateVideo = useCallback(() => {
    generateVideoFromImage();
  }, [generateVideoFromImage]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(dismissError, 5000);
    return () => clearTimeout(timer);
  }, [error, dismissError]);

  const showVideo = mode === 'video' && video !== null;

  return (
    <ErrorBoundary>
      <div className="app">
        <main className="main-content">
          {showVideo ? (
            <VideoDisplay
              video={video}
              appState={appState}
              onSwitchToImage={switchToImageMode}
            />
          ) : (
            <ImageDisplay
              image={image}
              appState={appState}
              onImageUpload={handleImageUpload}
              onSaveToGallery={handleSaveToGallery}
              onGenerateVideo={handleGenerateVideo}
              isVideoGenerating={appState === 'generating-video'}
              isImageSaved={isImageSaved}
            />
          )}
          <TranscriptHistory transcripts={transcripts} onClear={clearHistory} />
          {gallery.isOpen && (
            <Gallery
              items={gallery.items}
              onLoad={handleGalleryLoad}
              onDelete={gallery.removeImage}
              onClose={gallery.close}
            />
          )}
        </main>

        <footer className="controls">
          <VoiceInput
            isRecording={isRecording}
            volumeLevels={volumeLevels}
            onToggle={handleToggle}
            onUpload={handleImageUpload}
            onGalleryClick={gallery.isOpen ? gallery.close : gallery.open}
          />
        </footer>

        {error && (
          <div className="error-toast" onClick={dismissError}>
            <strong>{errorLabel(error.category)}:</strong> {error.message}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
