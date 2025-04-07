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

  // Request screen wake lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLockAPI = (navigator as any).wakeLock as WakeLockType;
        if (wakeLockAPI) {
          const lock = await wakeLockAPI.request('screen');
          setWakeLock(lock);
          console.log('Screen Wake Lock is active');

          lock.addEventListener('release', () => {
            console.log('Screen Wake Lock was released');
            setWakeLock(null);
          });

          return lock;
        }
      }
      console.log('Screen Wake Lock API not supported');
      return null;
    } catch (err) {
      console.error('Screen Wake Lock request failed:', err);
      return null;
    }
  };

  // Handle screen wake lock when playing status changes
  useEffect(() => {
    let lockPromise: Promise<WakeLockSentinel | null> | null = null;

    if (isPlaying) {
      lockPromise = requestWakeLock();
    } else {
      // Release wake lock when not playing
      if (wakeLock && !wakeLock.released) {
        wakeLock.release().catch(err => console.error('Screen Wake Lock release error:', err));
      }
    }

    // Clean up screen wake lock only
    return () => {
      if (lockPromise) {
        lockPromise.then(lock => {
          if (lock && !lock.released) {
            lock.release().catch(err => console.error('Screen Wake Lock release error:', err));
          }
        });
      } 
      // Ensure wake lock is released if component unmounts while playing
      else if (wakeLock && !wakeLock.released) {
           wakeLock.release().catch(err => console.error('Screen Wake Lock release error on unmount:', err));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]); // wakeLock is intentionally omitted to prevent re-running when lock instance changes, only on isPlaying

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