import { createContext } from "preact";
import {
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "preact/hooks";
import type { Take } from "../components/compose/types";

export interface PlayerTrack {
  takeId: string;
  trackIndex: number;
  audioUrl: string;
  label: string;
}

export function flattenTakes(takes: Take[]): PlayerTrack[] {
  const out: PlayerTrack[] = [];
  for (const take of takes) {
    if (take.tracks && take.tracks.length > 0) {
      for (const t of take.tracks) {
        if (!t.audioUrl) continue;
        out.push({
          takeId: take.id,
          trackIndex: t.index,
          audioUrl: t.audioUrl,
          label: t.title || take.generatedTitle || "Untitled",
        });
      }
    } else if (take.audioUrl) {
      out.push({
        takeId: take.id,
        trackIndex: 0,
        audioUrl: take.audioUrl,
        label: take.generatedTitle || "Untitled",
      });
    }
  }
  return out;
}

interface PlayerCtx {
  current: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (track: PlayerTrack) => void;
  loadPaused: (track: PlayerTrack) => void;
  toggle: (track: PlayerTrack) => void;
  togglePlayPause: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

const Ctx = createContext<PlayerCtx>({
  current: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  play: () => {},
  loadPaused: () => {},
  toggle: () => {},
  togglePlayPause: () => {},
  pause: () => {},
  seek: () => {},
});

export function usePlayer(): PlayerCtx {
  return useContext(Ctx);
}

export function PlayerProvider({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const teardownAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.onended = null;
      audioRef.current = null;
    }
  };

  const loadTrack = useCallback((track: PlayerTrack, autoplay: boolean) => {
    teardownAudio();
    const audio = new Audio(track.audioUrl);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration || 0);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
    setCurrent(track);
    setCurrentTime(0);
    setDuration(0);
    if (autoplay) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(
    (track: PlayerTrack) => loadTrack(track, true),
    [loadTrack],
  );

  const loadPaused = useCallback(
    (track: PlayerTrack) => loadTrack(track, false),
    [loadTrack],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const toggle = useCallback(
    (track: PlayerTrack) => {
      if (
        current?.takeId === track.takeId &&
        current?.trackIndex === track.trackIndex
      ) {
        if (isPlaying) pause();
        else resume();
        return;
      }
      play(track);
    },
    [current, isPlaying, play, pause, resume],
  );

  const togglePlayPause = useCallback(() => {
    if (!current) return;
    if (isPlaying) pause();
    else resume();
  }, [current, isPlaying, pause, resume]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        current,
        isPlaying,
        currentTime,
        duration,
        play,
        loadPaused,
        toggle,
        togglePlayPause,
        pause,
        seek,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
