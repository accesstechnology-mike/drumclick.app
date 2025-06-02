'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

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

export default function AudioWakeLock({ isPlaying, children }: AudioWakeLockProps) {
  const [wakeLockStatus, setWakeLockStatus] = useState<'active' | 'released' | 'unsupported' | 'error'>('unsupported');
  
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create silent audio for preventing audio context suspension
  const createSilentAudio = useCallback(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.01; // Nearly silent but not muted
    
    // Create a data URL for silent audio
    const silentDataUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audio.src = silentDataUrl;
    
    return audio;
  }, []);

  // Request wake lock with aggressive retry logic
  const requestWakeLock = useCallback(async (): Promise<WakeLockSentinel | null> => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        
        wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
          setWakeLockStatus('released');
          
          // Attempt to re-acquire if still playing
          if (isPlaying) {
            console.log('Wake lock released while playing - attempting to re-acquire in 1 second');
            retryTimeoutRef.current = setTimeout(() => {
              requestWakeLock().then(newLock => {
                wakeLockRef.current = newLock;
              });
            }, 1000);
          }
        });
        
        setWakeLockStatus('active');
        console.log('Wake lock acquired successfully');
        return wakeLock;
      } else {
        console.log('Wake Lock API not supported');
        setWakeLockStatus('unsupported');
        return null;
      }
    } catch (error) {
      console.error('Wake lock request failed:', error);
      setWakeLockStatus('error');
      
      // Retry after delay if still playing
      if (isPlaying) {
        retryTimeoutRef.current = setTimeout(() => {
          requestWakeLock().then(newLock => {
            wakeLockRef.current = newLock;
          });
        }, 2000);
      }
      
      return null;
    }
  }, [isPlaying]);

  // Start silent audio loop
  const startSilentAudio = useCallback(async () => {
    try {
      if (!silentAudioRef.current) {
        silentAudioRef.current = createSilentAudio();
      }
      
      await silentAudioRef.current.play();
      console.log('Silent audio loop started');
    } catch (error) {
      console.error('Failed to start silent audio:', error);
    }
  }, [createSilentAudio]);

  // Stop silent audio loop
  const stopSilentAudio = useCallback(() => {
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current.currentTime = 0;
      console.log('Silent audio loop stopped');
    }
  }, []);

  // Handle playing state changes
  useEffect(() => {
    if (isPlaying) {
      // Start wake lock and silent audio when playing
      const initializeWakeLock = async () => {
        // Start silent audio first
        await startSilentAudio();
        
        // Then request wake lock
        wakeLockRef.current = await requestWakeLock();
      };
      
      initializeWakeLock();
    } else {
      // Release wake lock and stop silent audio when not playing
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(err => 
          console.error('Wake lock release error:', err)
        );
      }
      
      stopSilentAudio();
      
      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      setWakeLockStatus('released');
    }

    // Cleanup function
    return () => {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(err => 
          console.error('Wake lock cleanup error:', err)
        );
      }
      
      stopSilentAudio();
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [isPlaying, requestWakeLock, startSilentAudio, stopSilentAudio]);

  // Handle visibility changes (tab switching, backgrounding)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        console.log('Tab became visible - checking wake lock status');
        
        // Restart silent audio if needed
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          await startSilentAudio();
        }
        
        // Re-request wake lock if released
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          console.log('Re-acquiring wake lock after visibility change');
          wakeLockRef.current = await requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, requestWakeLock, startSilentAudio]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release();
      }
      stopSilentAudio();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stopSilentAudio]);

  // Development: Log wake lock status changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Wake lock status:', wakeLockStatus);
    }
  }, [wakeLockStatus]);

  return <>{children}</>;
} 