'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

export interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  thumbnailUrl?: string;
  initialPosition?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
}

// Vimeo URL → embed URL 변환
function getVimeoEmbedUrl(url: string, startTime?: number): string | null {
  // https://vimeo.com/123456789
  // https://vimeo.com/123456789/abcdef (private link)
  // https://player.vimeo.com/video/123456789
  let match = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!match) return null;
  const videoId = match[1];
  const hash = match[2];
  let embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=0&title=0&byline=0&portrait=0`;
  if (hash) embedUrl += `&h=${hash}`;
  if (startTime && startTime > 0) embedUrl += `#t=${Math.floor(startTime)}s`;
  return embedUrl;
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/.test(url);
}

// Vimeo Player (iframe 기반)
function VimeoPlayer({ videoUrl, title, initialPosition, onProgress, onComplete }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [loaded, setLoaded] = useState(false);

  const embedUrl = getVimeoEmbedUrl(videoUrl, initialPosition);

  // Vimeo postMessage API로 진도 추적
  useEffect(() => {
    if (!loaded || !iframeRef.current) return;

    const iframe = iframeRef.current;

    // Enable Vimeo API
    const postMsg = (action: string, value?: unknown) => {
      const data: Record<string, unknown> = { method: action };
      if (value !== undefined) data.value = value;
      iframe.contentWindow?.postMessage(JSON.stringify(data), '*');
    };

    // Listen for events
    postMsg('addEventListener', 'timeupdate');
    postMsg('addEventListener', 'finish');

    let currentTime = 0;
    let duration = 0;
    let hasCompleted = false;

    const handleMessage = (e: MessageEvent) => {
      if (!e.origin.includes('vimeo.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.event === 'timeupdate') {
          currentTime = data.data?.seconds || 0;
          duration = data.data?.duration || 0;
        }
        if (data.event === 'finish') {
          hasCompleted = true;
          onComplete?.();
        }
      } catch {
        // ignore parse errors
      }
    };

    window.addEventListener('message', handleMessage);

    // Save progress every 5 seconds
    if (onProgress) {
      progressRef.current = setInterval(() => {
        if (currentTime > 0 && duration > 0) {
          onProgress(currentTime, duration);
          if (!hasCompleted && duration > 0 && (currentTime / duration) >= 0.9) {
            hasCompleted = true;
            onComplete?.();
          }
        }
      }, 5000);
    }

    // Save on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
      if (progressRef.current) clearInterval(progressRef.current);
      if (currentTime > 0 && duration > 0 && onProgress) {
        onProgress(currentTime, duration);
      }
    };
  }, [loaded, onProgress, onComplete]);

  // beforeunload
  useEffect(() => {
    const handleUnload = () => {
      // Can't reliably get Vimeo time on unload, but interval covers most cases
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  if (!embedUrl) {
    return (
      <div className="relative aspect-video w-full rounded-xl bg-black flex items-center justify-center">
        <p className="text-red-400">유효하지 않은 Vimeo URL입니다</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title || '강의 영상'}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// HTML5 Native Player (MP4 등 직접 URL)
function NativePlayer({
  videoUrl,
  title = '강의 영상',
  thumbnailUrl,
  initialPosition = 0,
  onProgress,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressSaveRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsRef = useRef<NodeJS.Timeout | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setLoading(false);
      if (initialPosition > 0 && initialPosition < videoRef.current.duration) {
        videoRef.current.currentTime = initialPosition;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
      if (!hasCompleted && duration > 0 && (current / duration) >= 0.9) {
        setHasCompleted(true);
        onComplete?.();
      }
    }
  };

  const handleBufferProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered(duration > 0 ? (bufferedEnd / duration) * 100 : 0);
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  }, [playing]);

  const handleSkip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  }, [duration]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (val > 0) setMuted(false);
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }, [muted]);

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (videoRef.current) videoRef.current.playbackRate = newSpeed;
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleRetry = () => {
    if (!videoRef.current) return;
    setError(null);
    setLoading(true);
    videoRef.current.load();
  };

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    if (playing) {
      hideControlsRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (playing && onProgress) {
      progressSaveRef.current = setInterval(() => {
        if (videoRef.current) onProgress(videoRef.current.currentTime, videoRef.current.duration);
      }, 5000);
    }
    return () => { if (progressSaveRef.current) clearInterval(progressSaveRef.current); };
  }, [playing, onProgress]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (videoRef.current && onProgress) onProgress(videoRef.current.currentTime, videoRef.current.duration);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [onProgress]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); handleSkip(-10); break;
        case 'ArrowRight': e.preventDefault(); handleSkip(10); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSkip, toggleMute, toggleFullscreen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl group select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      onTouchStart={resetHideTimer}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        className="absolute inset-0 w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleBufferProgress}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => setError('영상을 불러올 수 없습니다')}
        playsInline
        preload="metadata"
        aria-label={title}
      />

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-center space-y-4">
            <svg className="w-12 h-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-400 font-medium">{error}</p>
            <button onClick={handleRetry} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              다시 시도
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 cursor-pointer z-[5]" onClick={togglePlay}>
        {!playing && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/30 backdrop-blur-sm transition-transform hover:scale-110">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 z-10 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative mb-3 h-1 w-full cursor-pointer rounded-full bg-white/20 hover:h-2 transition-all group/bar"
          onClick={handleProgressClick}
        >
          <div className="absolute h-full rounded-full bg-white/30" style={{ width: `${buffered}%` }} />
          <div className="absolute h-full rounded-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
          <div className="absolute h-3 w-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 top-1/2 -translate-y-1/2 -translate-x-1/2 transition-opacity" style={{ left: `${progress}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={togglePlay} className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors" aria-label={playing ? '일시정지' : '재생'}>
              {playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={() => handleSkip(-10)} className="hidden sm:block p-2 text-white/80 hover:bg-white/10 rounded-lg transition-colors" aria-label="10초 뒤로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
            </button>
            <button onClick={() => handleSkip(10)} className="hidden sm:block p-2 text-white/80 hover:bg-white/10 rounded-lg transition-colors" aria-label="10초 앞으로">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
            </button>
            <div className="hidden md:flex items-center gap-1">
              <button onClick={toggleMute} className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors" aria-label={muted ? '음소거 해제' : '음소거'}>
                {muted || volume === 0 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                )}
              </button>
              <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolumeChange} className="w-16 h-1 accent-purple-500 cursor-pointer" aria-label="볼륨" />
            </div>
            <span className="hidden md:block ml-2 text-xs text-white font-mono whitespace-nowrap">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="relative">
              <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="px-2 py-1 text-xs font-bold text-white hover:bg-white/10 rounded-lg transition-colors">{speed}x</button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-black/95 border border-white/10 rounded-lg overflow-hidden shadow-xl">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                    <button key={s} onClick={() => handleSpeedChange(s)} className={`block w-full px-4 py-2 text-xs text-center hover:bg-white/20 transition-colors ${speed === s ? 'text-purple-400 bg-purple-500/20' : 'text-white'}`}>{s}x</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFullscreen} className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors" aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className="md:hidden text-center mt-1">
          <span className="text-xs text-white/60 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// Main VideoPlayer: auto-detects Vimeo vs native
export default function VideoPlayer(props: VideoPlayerProps) {
  if (!props.videoUrl) {
    return (
      <div className="relative aspect-video w-full rounded-xl bg-black flex items-center justify-center">
        <div className="text-center text-white/60">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <p>영상이 준비되지 않았습니다</p>
        </div>
      </div>
    );
  }

  if (isVimeoUrl(props.videoUrl)) {
    return <VimeoPlayer {...props} />;
  }

  return <NativePlayer {...props} />;
}
