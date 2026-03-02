// src/components/lms/VideoPlayer.tsx
// 비디오 플레이어 - Vimeo iframe + HTML5 native 지원
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  thumbnailUrl?: string;
  initialPosition?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url);
}

function getVimeoEmbedUrl(url: string): string {
  // Extract video ID from various Vimeo URL formats
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const id = match ? match[1] : url.replace(/\D/g, '');
  return `https://player.vimeo.com/video/${id}?autoplay=0&title=0&byline=0&portrait=0`;
}

// Vimeo Player sub-component with SDK progress tracking
function VimeoPlayer({ videoUrl, title, initialPosition = 0, onProgress, onComplete }: Omit<VideoPlayerProps, 'thumbnailUrl'>) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<unknown>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completionFiredRef = useRef(false);
  const [vimeoProgress, setVimeoProgress] = useState(0);
  const [vimeoDuration, setVimeoDuration] = useState(0);

  useEffect(() => {
    if (!iframeRef.current) return;

    let player: { on: (event: string, cb: (data: Record<string, number>) => void) => void; getCurrentTime: () => Promise<number>; getDuration: () => Promise<number>; setCurrentTime: (t: number) => Promise<number>; destroy: () => void } | null = null;

    // Dynamic import to avoid SSR issues
    import('@vimeo/player').then((VimeoPlayerLib) => {
      const Player = VimeoPlayerLib.default;
      player = new Player(iframeRef.current!) as typeof player;
      playerRef.current = player;

      // Set initial position (resume)
      if (initialPosition > 0 && player) {
        player.setCurrentTime(initialPosition).catch(() => {});
      }

      // Get duration
      if (player) {
        player.getDuration().then((dur: number) => setVimeoDuration(dur)).catch(() => {});
      }

      // Track progress via timeupdate event
      if (player) {
        player.on('timeupdate', (data: Record<string, number>) => {
          setVimeoProgress(data.seconds || 0);
          setVimeoDuration(data.duration || 0);
        });
      }

      // Track completion
      if (player) {
        player.on('ended', () => {
          if (!completionFiredRef.current && onComplete) {
            onComplete();
            completionFiredRef.current = true;
          }
        });
      }
    }).catch((err) => {
      console.error('[VimeoPlayer] Failed to load @vimeo/player:', err);
    });

    return () => {
      if (player) {
        try { player.destroy(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // Save progress every 5 seconds
  useEffect(() => {
    if (onProgress && vimeoDuration > 0) {
      progressIntervalRef.current = setInterval(() => {
        if (vimeoProgress > 0 && vimeoDuration > 0) {
          onProgress(vimeoProgress, vimeoDuration);
        }
      }, 5000);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [onProgress, vimeoProgress, vimeoDuration]);

  // Check 90% completion
  useEffect(() => {
    if (vimeoDuration > 0 && vimeoProgress / vimeoDuration >= 0.9 && !completionFiredRef.current) {
      if (onComplete) { onComplete(); completionFiredRef.current = true; }
    }
  }, [vimeoProgress, vimeoDuration, onComplete]);

  const pct = vimeoDuration > 0 ? Math.round((vimeoProgress / vimeoDuration) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <iframe
          ref={iframeRef}
          src={getVimeoEmbedUrl(videoUrl)}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title || 'Vimeo video'}
        />
      </div>
      {/* Progress bar */}
      {vimeoDuration > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {pct >= 90 ? '✅ 시청완료' : `${pct}% 시청`}
          </span>
        </div>
      )}
    </div>
  );
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ videoUrl, title, thumbnailUrl, initialPosition = 0, onProgress, onComplete }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const completionFired = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  // Save progress every 5 seconds
  useEffect(() => {
    if (playing && onProgress) {
      progressInterval.current = setInterval(() => {
        const v = videoRef.current;
        if (v && v.duration > 0) {
          onProgress(v.currentTime, v.duration);
        }
      }, 5000);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [playing, onProgress]);

  // Set initial position
  useEffect(() => {
    const v = videoRef.current;
    if (v && initialPosition > 0) {
      const handleLoaded = () => { v.currentTime = initialPosition; };
      v.addEventListener('loadedmetadata', handleLoaded, { once: true });
      return () => v.removeEventListener('loadedmetadata', handleLoaded);
    }
  }, [initialPosition]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); break;
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); v.muted = !v.muted; setMuted(v.muted); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      el.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const handleSpeedChange = (s: number) => {
    const v = videoRef.current;
    if (v) { v.playbackRate = s; setSpeed(s); }
    setShowSpeedMenu(false);
  };

  // Vimeo: render iframe with Player SDK for progress tracking
  if (isVimeoUrl(videoUrl)) {
    return (
      <VimeoPlayer
        videoUrl={videoUrl}
        title={title}
        initialPosition={initialPosition}
        onProgress={onProgress}
        onComplete={onComplete}
      />
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-4">
        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-red-400 text-sm">영상을 로드할 수 없습니다</p>
        <button onClick={() => { setError(false); videoRef.current?.load(); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">다시 시도</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden group">
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        className="w-full h-full object-contain"
        onClick={() => { const v = videoRef.current; v?.paused ? v.play() : v?.pause(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); if (onProgress && videoRef.current) onProgress(videoRef.current.currentTime, videoRef.current.duration); }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => setError(true)}
        onEnded={() => {
          setPlaying(false);
          if (!completionFired.current && onComplete) { onComplete(); completionFired.current = true; }
          if (onProgress && videoRef.current) onProgress(videoRef.current.currentTime, videoRef.current.duration);
        }}
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white" />
        </div>
      )}

      {/* Title overlay */}
      {title && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-sm font-medium truncate">{title}</p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/20 rounded cursor-pointer mb-3 group/bar" onClick={handleSeek}>
          <div className="h-full bg-purple-500 rounded relative" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={() => { const v = videoRef.current; v?.paused ? v.play() : v?.pause(); }} className="text-white hover:text-purple-400">
              {playing ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            {/* Time */}
            <span className="text-white text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed */}
            <div className="relative">
              <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="text-white text-xs hover:text-purple-400 px-1.5 py-0.5 rounded bg-white/10">
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => handleSpeedChange(s)} className={`block w-full px-4 py-1.5 text-xs text-left hover:bg-slate-700 ${speed === s ? 'text-purple-400' : 'text-white'}`}>{s}x</button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <button onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); }}} className="text-white hover:text-purple-400">
              {muted || volume === 0 ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              )}
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-purple-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isFullscreen ? "M6 18L18 6M6 6l12 12" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
