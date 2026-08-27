import { useEffect, useRef, useState } from "react";
import { useEvaluationStore } from "../store/evaluationStore";

interface AudioPlayerProps {
  src?: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(600); // 10 minutes default
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSeekMs = useEvaluationStore((state) => state.activeSeekMs);

  useEffect(() => {
    if (activeSeekMs !== null) {
      const seekSec = activeSeekMs / 1000;
      setCurrentTime(seekSec);
      if (audioRef.current) {
        audioRef.current.currentTime = seekSec;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, [activeSeekMs]);

  function togglePlay() {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    } else {
      setIsPlaying(!isPlaying);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  }

  function formatTime(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface-900/80 p-4 shadow-lg">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
      />

      <div className="flex items-center justify-between gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-md"
        >
          {isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time display & Waveform scrubber */}
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex justify-between font-mono text-xs text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="h-2 w-full cursor-pointer accent-brand-500 bg-white/10 rounded-lg"
          />
        </div>

        {/* Speed selector */}
        <button
          onClick={() => {
            const nextRate = playbackRate === 1.0 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0;
            setPlaybackRate(nextRate);
            if (audioRef.current) audioRef.current.playbackRate = nextRate;
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
}
