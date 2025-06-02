'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface DiagnosticData {
  wakeLockStatus: 'active' | 'released' | 'unsupported' | 'error';
  audioContextState: 'suspended' | 'running' | 'closed' | 'unknown';
  silentAudioActive: boolean;
  videoWorkaroundActive: boolean;
  timeSinceStart: number;
  audioSuspensions: number;
  wakeLockFailures: number;
  lastSuspensionTime: number | null;
  batteryInfo: { charging: boolean; level: number } | null;
  fullscreenActive: boolean;
}

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
}

export default function WakeLockDiagnostics() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData>({
    wakeLockStatus: 'unsupported',
    audioContextState: 'unknown',
    silentAudioActive: false,
    videoWorkaroundActive: false,
    timeSinceStart: 0,
    audioSuspensions: 0,
    wakeLockFailures: 0,
    lastSuspensionTime: null,
    batteryInfo: null,
    fullscreenActive: false,
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const diagnosticsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Silent audio blob (1 second of silence)
  const createSilentAudio = useCallback(() => {
    if (!audioContextRef.current) return null;
    
    const context = audioContextRef.current;
    const length = context.sampleRate * 1; // 1 second
    const buffer = context.createBuffer(1, length, context.sampleRate);
    
    // Create silent audio element
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.01; // Nearly silent but not muted
    
    // Create a data URL for silent audio
    const silentDataUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audio.src = silentDataUrl;
    
    return audio;
  }, []);

  // Create black video with embedded audio
  const createVideoWorkaround = useCallback(() => {
    const video = document.createElement('video');
    video.muted = false;
    video.loop = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '-1px';
    video.style.left = '-1px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01';
    
    // Create a canvas to generate black video frames
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 1, 1);
    }
    
    // Convert to blob and set as video source
    canvas.toBlob((blob) => {
      if (blob) {
        video.src = URL.createObjectURL(blob);
      }
    });
    
    return video;
  }, []);

  // Request wake lock with aggressive retry
  const requestWakeLock = useCallback(async (): Promise<WakeLockSentinel | null> => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        
        wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
          setDiagnostics(prev => ({ 
            ...prev, 
            wakeLockStatus: 'released',
            wakeLockFailures: prev.wakeLockFailures + 1
          }));
          
          // Attempt to re-acquire if test is still running
          if (isTestRunning) {
            setTimeout(requestWakeLock, 1000);
          }
        });
        
        return wakeLock;
      }
      return null;
    } catch (error) {
      console.error('Wake lock request failed:', error);
      setDiagnostics(prev => ({ 
        ...prev, 
        wakeLockStatus: 'error',
        wakeLockFailures: prev.wakeLockFailures + 1
      }));
      return null;
    }
  }, [isTestRunning]);

  // Update diagnostics
  const updateDiagnostics = useCallback(async () => {
    const timeSinceStart = Date.now() - startTimeRef.current;
    
    // Check battery info
    let batteryInfo = null;
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        batteryInfo = {
          charging: battery.charging,
          level: Math.round(battery.level * 100)
        };
      } catch (e) {
        // Battery API not available
      }
    }

    setDiagnostics(prev => ({
      ...prev,
      timeSinceStart: Math.floor(timeSinceStart / 1000),
      wakeLockStatus: wakeLockRef.current && !wakeLockRef.current.released ? 'active' : 
                     wakeLockRef.current?.released ? 'released' : 'unsupported',
      audioContextState: audioContextRef.current?.state || 'unknown',
      batteryInfo,
      fullscreenActive: !!document.fullscreenElement,
    }));
  }, []);

  // Start comprehensive test
  const startTest = useCallback(async () => {
    setIsTestRunning(true);
    startTimeRef.current = Date.now();
    
    // 1. Initialize audio context
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Monitor audio context state changes
      audioContextRef.current.addEventListener('statechange', () => {
        if (audioContextRef.current?.state === 'suspended') {
          setDiagnostics(prev => ({
            ...prev,
            audioSuspensions: prev.audioSuspensions + 1,
            lastSuspensionTime: Date.now()
          }));
          
          // Try to resume
          audioContextRef.current?.resume();
        }
      });
      
      await audioContextRef.current.resume();
    } catch (error) {
      console.error('Audio context creation failed:', error);
    }

    // 2. Start silent audio loop
    try {
      silentAudioRef.current = createSilentAudio();
      if (silentAudioRef.current) {
        await silentAudioRef.current.play();
        setDiagnostics(prev => ({ ...prev, silentAudioActive: true }));
      }
    } catch (error) {
      console.error('Silent audio failed:', error);
    }

    // 3. Start video workaround
    try {
      videoRef.current = createVideoWorkaround();
      if (videoRef.current) {
        document.body.appendChild(videoRef.current);
        await videoRef.current.play();
        setDiagnostics(prev => ({ ...prev, videoWorkaroundActive: true }));
      }
    } catch (error) {
      console.error('Video workaround failed:', error);
    }

    // 4. Request wake lock
    wakeLockRef.current = await requestWakeLock();

    // 5. Request fullscreen (optional but helps with wake lock)
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen request failed (expected on desktop):', error);
    }

    // 6. Start diagnostic monitoring
    diagnosticsIntervalRef.current = setInterval(updateDiagnostics, 1000);
    
    // 7. Add visibility change handler
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isTestRunning) {
        // Resume audio context
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Re-request wake lock if released
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          wakeLockRef.current = await requestWakeLock();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [createSilentAudio, createVideoWorkaround, requestWakeLock, updateDiagnostics, isTestRunning]);

  // Stop test
  const stopTest = useCallback(() => {
    setIsTestRunning(false);
    
    // Clean up wake lock
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      wakeLockRef.current.release();
    }
    
    // Clean up audio
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current = null;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clean up video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.remove();
      videoRef.current = null;
    }
    
    // Clean up interval
    if (diagnosticsIntervalRef.current) {
      clearInterval(diagnosticsIntervalRef.current);
    }
    
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    setDiagnostics(prev => ({
      ...prev,
      silentAudioActive: false,
      videoWorkaroundActive: false,
      fullscreenActive: false,
    }));
  }, []);

  // Calculate test results
  const getTestResults = () => {
    const timeMinutes = diagnostics.timeSinceStart / 60;
    const suspensionRate = timeMinutes > 0 ? (diagnostics.audioSuspensions / timeMinutes) : 0;
    const wakeLockFailureRate = timeMinutes > 0 ? (diagnostics.wakeLockFailures / timeMinutes) : 0;
    
    let rating: 'excellent' | 'good' | 'poor' | 'critical';
    if (suspensionRate === 0 && wakeLockFailureRate === 0) rating = 'excellent';
    else if (suspensionRate < 0.5 && wakeLockFailureRate < 0.5) rating = 'good';
    else if (suspensionRate < 2 && wakeLockFailureRate < 2) rating = 'poor';
    else rating = 'critical';
    
    return { suspensionRate, wakeLockFailureRate, rating };
  };

  const results = getTestResults();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🚨 Wake Lock & Audio Reliability Test</CardTitle>
          <CardDescription>
            This test determines if we can stay pure PWA or need to go hybrid (Capacitor).
            Run for at least 30 minutes on your target Android devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={startTest} 
              disabled={isTestRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              Start Comprehensive Test
            </Button>
            <Button 
              onClick={stopTest} 
              disabled={!isTestRunning}
              variant="destructive"
            >
              Stop Test
            </Button>
          </div>
          
          {isTestRunning && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-800">Test Running</p>
              <p className="text-sm text-yellow-700">
                Keep this page active. Try backgrounding the app, changing battery settings, etc.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Wake Lock:</span>
              <Badge variant={diagnostics.wakeLockStatus === 'active' ? 'default' : 'destructive'}>
                {diagnostics.wakeLockStatus}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Audio Context:</span>
              <Badge variant={diagnostics.audioContextState === 'running' ? 'default' : 'destructive'}>
                {diagnostics.audioContextState}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Silent Audio:</span>
              <Badge variant={diagnostics.silentAudioActive ? 'default' : 'secondary'}>
                {diagnostics.silentAudioActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Video Workaround:</span>
              <Badge variant={diagnostics.videoWorkaroundActive ? 'default' : 'secondary'}>
                {diagnostics.videoWorkaroundActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Fullscreen:</span>
              <Badge variant={diagnostics.fullscreenActive ? 'default' : 'secondary'}>
                {diagnostics.fullscreenActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {diagnostics.batteryInfo && (
              <div className="flex justify-between">
                <span>Battery:</span>
                <span className="text-sm">
                  {diagnostics.batteryInfo.level}% 
                  {diagnostics.batteryInfo.charging ? ' (Charging)' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Test Duration:</span>
              <span>{Math.floor(diagnostics.timeSinceStart / 60)}m {diagnostics.timeSinceStart % 60}s</span>
            </div>
            <div className="flex justify-between">
              <span>Audio Suspensions:</span>
              <Badge variant={diagnostics.audioSuspensions === 0 ? 'default' : 'destructive'}>
                {diagnostics.audioSuspensions}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Wake Lock Failures:</span>
              <Badge variant={diagnostics.wakeLockFailures === 0 ? 'default' : 'destructive'}>
                {diagnostics.wakeLockFailures}
              </Badge>
            </div>
            {diagnostics.lastSuspensionTime && (
              <div className="flex justify-between">
                <span>Last Suspension:</span>
                <span className="text-sm">
                  {Math.floor((Date.now() - diagnostics.lastSuspensionTime) / 1000)}s ago
                </span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Suspension Rate:</span>
                <span>{results.suspensionRate.toFixed(1)}/min</span>
              </div>
              <Progress value={Math.min(results.suspensionRate * 20, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Decision Recommendation
            <Badge className="ml-2" variant={
              results.rating === 'excellent' ? 'default' :
              results.rating === 'good' ? 'secondary' :
              results.rating === 'poor' ? 'outline' : 'destructive'
            }>
              {results.rating.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.rating === 'excellent' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold text-green-800">✅ Go Pure PWA</p>
              <p className="text-sm text-green-700">
                Excellent reliability. Wake lock and audio are stable. Pure PWA is viable.
              </p>
            </div>
          )}
          {results.rating === 'good' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-semibold text-blue-800">✅ Go Pure PWA (with monitoring)</p>
              <p className="text-sm text-blue-700">
                Good reliability with minor issues. PWA should work for most users.
              </p>
            </div>
          )}
          {results.rating === 'poor' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-800">⚠️ Consider Hybrid (Capacitor)</p>
              <p className="text-sm text-yellow-700">
                Frequent suspensions/failures. Consider Capacitor wrapper for reliability.
              </p>
            </div>
          )}
          {results.rating === 'critical' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-semibold text-red-800">🚨 Must Go Hybrid</p>
              <p className="text-sm text-red-700">
                Critical reliability issues. Native wrapper (Capacitor) is required.
              </p>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Test on multiple devices:</strong> Samsung Galaxy, Pixel, OnePlus/Xiaomi</p>
            <p><strong>Test scenarios:</strong> Battery saver mode, app backgrounded, screen timeout variations</p>
            <p><strong>Decision threshold:</strong> &gt;10% failure rate on any common device → Go hybrid</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 