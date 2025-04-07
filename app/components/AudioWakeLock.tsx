'use client';

import { useEffect, useState } from 'react';

interface AudioWakeLockProps {
  isPlaying: boolean;
  children?: React.ReactNode;
}

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

type WakeLockType = {
  request: (type: 'screen') => Promise<WakeLockSentinel>;
};

export default function AudioWakeLock({ isPlaying, children }: AudioWakeLockProps) {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [silentAudio, setSilentAudio] = useState<HTMLAudioElement | null>(null);

  // Request wake lock when component mounts
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLockAPI = (navigator as any).wakeLock as WakeLockType;
        if (wakeLockAPI) {
          const lock = await wakeLockAPI.request('screen');
          setWakeLock(lock);
          console.log('Wake Lock is active');

          lock.addEventListener('release', () => {
            console.log('Wake Lock was released');
            setWakeLock(null);
          });

          return lock;
        }
      }
      console.log('Wake Lock API not supported');
      return null;
    } catch (err) {
      console.error('Wake Lock request failed:', err);
      return null;
    }
  };

  // Handle wake lock when playing status changes
  useEffect(() => {
    let lockPromise: Promise<WakeLockSentinel | null> | null = null;

    if (isPlaying) {
      lockPromise = requestWakeLock();
      
      // Create and play silent audio to keep audio context alive in background
      if (!silentAudio) {
        const audio = new Audio('/silent-audio.mp3');
        audio.loop = true;
        audio.volume = 0.001; // Very low volume
        setSilentAudio(audio);
        audio.play().catch(err => console.error('Silent audio play error:', err));
      } else {
        silentAudio.play().catch(err => console.error('Silent audio play error:', err));
      }
    } else {
      // Release wake lock when not playing
      if (wakeLock && !wakeLock.released) {
        wakeLock.release().catch(err => console.error('Wake Lock release error:', err));
      }
      
      // Pause silent audio
      if (silentAudio) {
        silentAudio.pause();
      }
    }

    // Clean up
    return () => {
      if (lockPromise) {
        lockPromise.then(lock => {
          if (lock && !lock.released) {
            lock.release().catch(err => console.error('Wake Lock release error:', err));
          }
        });
      }
      
      if (silentAudio) {
        silentAudio.pause();
        silentAudio.src = '';
      }
    };
  }, [isPlaying]);

  // Re-request wake lock when visibility changes (tab becomes visible again)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        if (!wakeLock || wakeLock.released) {
          await requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, wakeLock]);

  return <>{children}</>;
} 