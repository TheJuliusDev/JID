import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface VoiceNoteProps {
  url: string;
  /** Peak amplitudes captured while recording (0..1), for the static waveform. */
  peaks?: number[];
  durationMs?: number;
  mine: boolean;
}

const BAR_COUNT = 28;

/**
 * A voice message.
 *
 * The waveform is decorative: it is drawn from the peaks recorded at capture
 * time, not from decoding the audio. That is deliberate — decoding on every
 * render of a long thread is expensive, and the peaks already tell the reader
 * how the recording sounded. Playback position is a single separate element.
 */
export const VoiceNote: React.FC<VoiceNoteProps> = ({ url, peaks, durationMs, mine }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Bars are normalised against the loudest peak so a quiet recording still
  // renders a readable shape instead of a flat line.
  const bars = React.useMemo(() => {
    const source = peaks && peaks.length ? peaks : null;
    const max = source ? Math.max(...source, 0.01) : 1;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      if (!source) {
        // No peaks (a message sent by an older client): a calm idle shape rather
        // than an empty bar, so the row does not look broken.
        return 0.25 + 0.15 * Math.sin(i / 2);
      }
      const idx = Math.floor((i / BAR_COUNT) * source.length);
      return Math.max(0.12, Math.min(1, (source[idx] ?? 0) / max));
    });
  }, [peaks]);

  // Stop playback if the bubble unmounts (thread switched, message deleted).
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
    setElapsed(audio.currentTime * 1000);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const totalMs = durationMs && durationMs > 0 ? durationMs : 0;
  const playedIndex = Math.round(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-3 min-w-[190px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setElapsed(0);
        }}
        onPause={() => setPlaying(false)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
          mine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-[2px] h-6 cursor-pointer"
          onClick={seek}
          role="presentation"
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                mine
                  ? i < playedIndex
                    ? 'bg-white'
                    : 'bg-white/35'
                  : i < playedIndex
                    ? 'bg-emerald-600'
                    : 'bg-emerald-600/25'
              }`}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <p className={`text-[10px] mt-0.5 ${mine ? 'text-emerald-100/80' : 'text-zinc-400'}`}>
          {formatDuration(totalMs ? elapsed : 0)} / {formatDuration(totalMs)}
        </p>
      </div>
    </div>
  );
};

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
