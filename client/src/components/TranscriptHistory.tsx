import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../types';

interface TranscriptHistoryProps {
  transcripts: TranscriptEntry[];
  onClear: () => void;
}

export function TranscriptHistory({
  transcripts,
  onClear,
}: TranscriptHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  if (transcripts.length === 0) return null;

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <h3>Transcript</h3>
        <button className="clear-button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="transcript-list">
        {transcripts.map((entry) => (
          <div key={entry.id} className="transcript-entry">
            <span className="transcript-text">{entry.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
