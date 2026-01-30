import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from '../types';

const SILENCE_THRESHOLD = 15;
const SILENCE_DURATION_MS = 2000;
const POLL_INTERVAL_MS = 100;
const FFT_SIZE = 256;

interface UseAudioRecorderReturn {
  isRecording: boolean;
  volumeLevels: number[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useAudioRecorder(
  onAudioChunk: (blob: Blob) => void,
  onError?: (error: AppError) => void,
): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [volumeLevels, setVolumeLevels] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close().catch((err) => {
        console.warn('[recorder] AudioContext close failed', err);
      });
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    silenceStartRef.current = null;
    hasSpokenRef.current = false;
    chunksRef.current = [];
    isRecordingRef.current = false;
    setIsRecording(false);
    setVolumeLevels([]);
  }, []);

  const finalizeChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const startNewRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !isRecordingRef.current) return;

    chunksRef.current = [];
    silenceStartRef.current = null;
    hasSpokenRef.current = false;

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      if (chunksRef.current.length > 0 && hasSpokenRef.current) {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onAudioChunk(blob);
      }
      if (isRecordingRef.current) {
        startNewRecording();
      }
    };

    recorder.onerror = () => {
      console.error('[recorder] MediaRecorder error');
      cleanup();
      onErrorRef.current?.(new AppError('Recording failed', 'microphone'));
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
  }, [onAudioChunk, cleanup]);

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permission.'
          : 'Could not access microphone';
      console.error('[recorder]', err);
      throw new AppError(message, 'microphone');
    }
    streamRef.current = stream;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);
    analyserRef.current = analyser;

    isRecordingRef.current = true;
    setIsRecording(true);

    startNewRecording();

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    pollIntervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(frequencyData);

      const bars = 32;
      const binSize = Math.floor(frequencyData.length / bars);
      const levels: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < binSize; j++) {
          sum += frequencyData[i * binSize + j];
        }
        levels.push(sum / binSize / 255);
      }
      setVolumeLevels(levels);

      const avg =
        frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;

      if (avg > SILENCE_THRESHOLD) {
        hasSpokenRef.current = true;
        silenceStartRef.current = null;
      } else if (hasSpokenRef.current) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = Date.now();
        } else if (
          Date.now() - silenceStartRef.current >=
          SILENCE_DURATION_MS
        ) {
          finalizeChunk();
        }
      }
    }, POLL_INTERVAL_MS);
  }, [startNewRecording, finalizeChunk]);

  const stopRecording = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { isRecording, volumeLevels, startRecording, stopRecording };
}
