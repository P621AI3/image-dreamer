import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from './useAudioRecorder';
import * as api from '../services/api';
import { saveSession, loadSession, clearSession } from '../services/session';
import type {
  TranscriptEntry,
  GeneratedImage,
  GeneratedVideo,
  AppState,
  AppMode,
} from '../types';
import { AppError } from '../types';

const FILLER_WORDS = new Set([
  'um',
  'uh',
  'hmm',
  'hm',
  'ah',
  'er',
  'like',
  'so',
  'yeah',
  'okay',
]);

function isMeaningful(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  return words.some((w) => !FILLER_WORDS.has(w.replace(/[.,!?]/g, '')));
}

function loadInitialState() {
  const session = loadSession();
  if (session) {
    console.debug(
      '[dreamer] restored session:',
      session.transcripts.length,
      'transcripts,',
      session.history.length,
      'history entries,',
      session.image ? 'with image' : 'no image',
    );
  }
  return {
    image: session?.image ?? null,
    transcripts: session?.transcripts ?? [],
    history: session?.history ?? [],
  };
}

export function useImageDreamer() {
  const initial = useRef(loadInitialState()).current;

  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>(
    initial.transcripts,
  );
  const [image, setImage] = useState<GeneratedImage | null>(initial.image);
  const [video, setVideo] = useState<GeneratedVideo | null>(null);
  const [mode, setMode] = useState<AppMode>('image');
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<AppError | null>(null);

  const historyRef = useRef<string[]>(initial.history);
  const imageRef = useRef<GeneratedImage | null>(initial.image);
  const videoRef = useRef<GeneratedVideo | null>(null);
  const sourceImageRef = useRef<string | null>(null);
  const modeRef = useRef<AppMode>('image');
  const activeRef = useRef(false);
  const appStateRef = useRef<AppState>('idle');

  // Persist session whenever image or transcripts change
  useEffect(() => {
    saveSession({
      image,
      transcripts,
      history: historyRef.current,
    });
  }, [image, transcripts]);

  const setTrackedState = useCallback((state: AppState) => {
    appStateRef.current = state;
    setAppState(state);
  }, []);

  // Resolve to 'listening' if mic is still active, 'idle' if user stopped
  const resolvePostProcessing = useCallback(() => {
    return activeRef.current ? 'listening' : 'idle';
  }, []);

  const handleAudioChunk = useCallback(
    async (blob: Blob) => {
      let text: string;
      try {
        setTrackedState('transcribing');
        text = await api.transcribeAudio(blob);
      } catch (err) {
        const appErr =
          err instanceof AppError
            ? err
            : new AppError(
                'Something went wrong with transcription -- try again',
                'transcription',
              );
        console.error('[dreamer] transcription error', err);
        setError(appErr);
        setTrackedState(resolvePostProcessing());
        return;
      }

      if (!isMeaningful(text)) {
        setTrackedState(resolvePostProcessing());
        return;
      }

      const entry: TranscriptEntry = {
        id: crypto.randomUUID(),
        text,
        timestamp: Date.now(),
      };
      setTranscripts((prev) => [...prev, entry]);
      historyRef.current = [...historyRef.current, text];

      if (modeRef.current === 'video') {
        // Video edit mode
        const currentVideo = videoRef.current;
        const currentSourceImage = sourceImageRef.current;
        if (!currentVideo || !currentSourceImage) {
          setTrackedState(resolvePostProcessing());
          return;
        }

        try {
          setTrackedState('editing-video');
          const edited = await api.editVideo(
            text,
            currentVideo.base64,
            currentSourceImage,
          );
          setVideo(edited);
          videoRef.current = edited;
          setError(null);
          setTrackedState(resolvePostProcessing());
        } catch (err) {
          const appErr =
            err instanceof AppError
              ? err
              : new AppError(
                  'Video editing hit a snag -- try again',
                  'video-generation',
                );
          console.error('[dreamer] video edit error', err);
          setError(appErr);
          setTrackedState(resolvePostProcessing());
        }
      } else {
        // Image generation mode
        try {
          setTrackedState('generating');
          const generated = await api.generateImage(
            historyRef.current,
            imageRef.current,
          );
          setImage(generated);
          imageRef.current = generated;
          setError(null);
          setTrackedState(resolvePostProcessing());
        } catch (err) {
          const appErr =
            err instanceof AppError
              ? err
              : new AppError(
                  'Image generation hit a snag -- try again',
                  'generation',
                );
          console.error('[dreamer] generation error', err);
          setError(appErr);
          setTrackedState(resolvePostProcessing());
        }
      }
    },
    [setTrackedState, resolvePostProcessing],
  );

  const handleRecorderError = useCallback(
    (err: AppError) => {
      console.error('[dreamer] recorder error', err);
      setError(err);
      setTrackedState('error');
    },
    [setTrackedState],
  );

  const { isRecording, volumeLevels, startRecording, stopRecording } =
    useAudioRecorder(handleAudioChunk, handleRecorderError);

  const start = useCallback(async () => {
    setError(null);
    activeRef.current = true;
    try {
      await startRecording();
      setTrackedState('listening');
    } catch (err) {
      activeRef.current = false;
      const appErr =
        err instanceof AppError
          ? err
          : new AppError('Failed to start recording', 'microphone');
      console.error('[dreamer] start error', err);
      setError(appErr);
      setTrackedState('error');
    }
  }, [startRecording, setTrackedState]);

  const stop = useCallback(() => {
    activeRef.current = false;
    stopRecording();
    // Only go idle immediately if nothing is in-flight
    const current = appStateRef.current;
    if (
      current !== 'transcribing' &&
      current !== 'generating' &&
      current !== 'generating-video' &&
      current !== 'editing-video'
    ) {
      setTrackedState('idle');
    }
    // Otherwise, the in-flight handler will resolve to 'idle' via resolvePostProcessing
  }, [stopRecording, setTrackedState]);

  const generateVideoFromImage = useCallback(async () => {
    const currentImage = imageRef.current;
    if (!currentImage) return;

    const prompt =
      historyRef.current.length > 0
        ? `Create a video based on this image and description: ${historyRef.current.join('. ')}`
        : 'Create a short video that brings this image to life with natural motion and cinematic quality.';

    try {
      setTrackedState('generating-video');
      const generated = await api.generateVideo(prompt, currentImage.base64);
      setVideo(generated);
      videoRef.current = generated;
      sourceImageRef.current = currentImage.base64;
      modeRef.current = 'video';
      setMode('video');
      setError(null);
      setTrackedState(resolvePostProcessing());
    } catch (err) {
      const appErr =
        err instanceof AppError
          ? err
          : new AppError(
              'Video generation hit a snag -- try again',
              'video-generation',
            );
      console.error('[dreamer] video generation error', err);
      setError(appErr);
      setTrackedState(resolvePostProcessing());
    }
  }, [setTrackedState, resolvePostProcessing]);

  const switchToImageMode = useCallback(() => {
    setVideo(null);
    videoRef.current = null;
    sourceImageRef.current = null;
    modeRef.current = 'image';
    setMode('image');
  }, []);

  const clearHistory = useCallback(() => {
    setTranscripts([]);
    setImage(null);
    setVideo(null);
    imageRef.current = null;
    videoRef.current = null;
    sourceImageRef.current = null;
    historyRef.current = [];
    modeRef.current = 'image';
    setMode('image');
    setError(null);
    clearSession();
  }, []);

  const setExternalImage = useCallback((img: GeneratedImage) => {
    setImage(img);
    imageRef.current = img;
    setVideo(null);
    videoRef.current = null;
    sourceImageRef.current = null;
    modeRef.current = 'image';
    setMode('image');
    setTranscripts([]);
    historyRef.current = [];
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
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
  };
}
