"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, Music, Volume2, Save, List, Trash2, Plus, SkipBack, SkipForward, GripVertical, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AudioWakeLock from "./AudioWakeLock";

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Playlist types
interface PlaylistItem {
  id: string;
  name: string;
  timeSignature: string;
  tempo: number;
  accentFirstBeat: boolean;
  subdivision: "1" | "1/2" | "1/3" | "1/4";
  voiceSubdivision: boolean;
  useClick: boolean;
  useVoice: boolean;
  isIncreasingTempo: boolean;
  startTempo: number;
  endTempo: number;
  duration: number;
  createdAt: string;
}

export default function ClickTrackGenerator() {
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [tempo, setTempo] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [accentFirstBeat, setAccentFirstBeat] = useState(true);
  const nextBeatTimeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerIdRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const tempoRef = useRef(tempo);
  const timeSignatureRef = useRef(timeSignature);
  const lastUpdateTimeRef = useRef(0);
  const accentFirstBeatRef = useRef(accentFirstBeat);
  const [tempoInput, setTempoInput] = useState(tempo.toString());
  const [useClick, setUseClick] = useState(true);
  const [useVoice, setUseVoice] = useState(false);
  const audioBuffersRef = useRef<AudioBuffer[]>([]);
  const [subdivision, setSubdivision] = useState<"1" | "1/2" | "1/3" | "1/4">(
    "1"
  );
  const subdivisionRef = useRef(subdivision);
  const [voiceSubdivision, setVoiceSubdivision] = useState(false);
  const voiceSubdivisionRef = useRef(voiceSubdivision);
  const hadToResumeRef = useRef(false);
  // Add refs for background audio
  const wakeLockSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wakeLockGainRef = useRef<GainNode | null>(null);
  // Remove hiddenAudioRef for HTMLAudioElement based silent audio
  // const hiddenAudioRef = useRef<HTMLAudioElement | null>(null);

  // New state variables for increasing tempo
  const [isIncreasingTempo, setIsIncreasingTempo] = useState(false);
  const [startTempo, setStartTempo] = useState(100);
  const [endTempo, setEndTempo] = useState(120);
  const [duration, setDuration] = useState(5); // in minutes
  const startTimeRef = useRef(0);

  // Add this near the top of your component, with other state declarations
  const [currentTempo, setCurrentTempo] = useState(tempo);

  // Add this state variable
  const [displayTempo, setDisplayTempo] = useState(tempo);

  // Playlist state
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isPlaylistDialogOpen, setIsPlaylistDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(-1);
  const [draggedIndex, setDraggedIndex] = useState<number>(-1);

  const createClickSound = useCallback((time: number, frequency: number) => {
    if (!audioContextRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    osc.frequency.setValueAtTime(frequency, time);
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.5, time + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, time + 0.1);

    osc.start(time);
    osc.stop(time + 0.1);
  }, []);

  const loadAudioFiles = useCallback(async () => {
    if (!audioContextRef.current) return;

    const samples = ["1", "2", "3", "4", "5", "6", "7", "eee", "and", "ah"];
    const buffers: (AudioBuffer | null)[] = await Promise.all(
      samples.map(async (sample) => {
        try {
          const response = await fetch(`/audio/${sample}.mp3`);
          if (!response.ok) {
            console.error(`Failed to fetch audio file ${sample}.mp3`);
            return null;
          }
          const arrayBuffer = await response.arrayBuffer();
          return await audioContextRef.current!.decodeAudioData(arrayBuffer);
        } catch (error) {
          console.error(`Error loading audio file ${sample}.mp3:`, error);
          return null;
        }
      })
    );

    audioBuffersRef.current = buffers.filter(
      (buffer): buffer is AudioBuffer => buffer !== null
    );
  }, []);

  const playVoice = useCallback((time: number, number: number) => {
    if (!audioContextRef.current || !audioBuffersRef.current[number]) {
      console.warn(`Audio buffer not available for number ${number + 1}`);
      return;
    }

    const source = audioContextRef.current.createBufferSource();
    const gainNode = audioContextRef.current.createGain();

    source.buffer = audioBuffersRef.current[number];

    // Set the gain to 0.5 (50% volume)
    gainNode.gain.setValueAtTime(0.5, time);

    source.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    source.start(time);
  }, []);

  const createSubdivisionClick = useCallback(
    (time: number, subBeat: number, subCount: number, isAccented: boolean) => {
      if (!audioContextRef.current) return;

      let frequency: number;
      if (subBeat === 0) {
        frequency = isAccented ? 1000 : 600; // Main beat
      } else if (subCount === 2) {
        frequency = 400; // Half note
      } else if (subCount === 3) {
        frequency = subBeat === 1 ? 500 : 400; // Triplet
      } else if (subCount === 4) {
        frequency = subBeat === 2 ? 500 : 400; // Quarter note
      } else {
        return; // No subdivision
      }

      const osc = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      osc.frequency.setValueAtTime(frequency, time);
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, time + 0.1);

      osc.start(time);
      osc.stop(time + 0.1);
    },
    []
  );

  const playSubdivision = useCallback(
    (time: number, subBeat: number, subCount: number) => {
      if (!audioContextRef.current) return;

      let sampleIndex: number;
      if (subCount === 2) {
        sampleIndex = 8; // "and"
      } else if (subCount === 3) {
        sampleIndex = subBeat === 1 ? 7 : 9; // "eee" or "ah"
      } else if (subCount === 4) {
        sampleIndex = subBeat === 1 ? 7 : subBeat === 2 ? 8 : 9; // "eee", "and", or "ah"
      } else {
        return; // No subdivision
      }

      if (audioBuffersRef.current[sampleIndex]) {
        const source = audioContextRef.current.createBufferSource();
        const gainNode = audioContextRef.current.createGain();

        source.buffer = audioBuffersRef.current[sampleIndex];
        gainNode.gain.setValueAtTime(0.5, time);

        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        source.start(time);
      }
    },
    []
  );

  // Playlist management functions
  const loadPlaylists = useCallback(() => {
    try {
      const saved = localStorage.getItem('drumclick-playlists');
      if (saved) {
        setPlaylists(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  }, []);

  const savePlaylists = useCallback((newPlaylists: PlaylistItem[]) => {
    try {
      localStorage.setItem('drumclick-playlists', JSON.stringify(newPlaylists));
      setPlaylists(newPlaylists);
    } catch (error) {
      console.error('Error saving playlists:', error);
    }
  }, []);

  const getCurrentSettings = useCallback((): Omit<PlaylistItem, 'id' | 'name' | 'createdAt'> => {
    return {
      timeSignature,
      tempo,
      accentFirstBeat,
      subdivision,
      voiceSubdivision,
      useClick,
      useVoice,
      isIncreasingTempo,
      startTempo,
      endTempo,
      duration
    };
  }, [timeSignature, tempo, accentFirstBeat, subdivision, voiceSubdivision, useClick, useVoice, isIncreasingTempo, startTempo, endTempo, duration]);

  const saveCurrentAsPlaylist = useCallback((name: string) => {
    const newPlaylist: PlaylistItem = {
      id: Date.now().toString(),
      name,
      ...getCurrentSettings(),
      createdAt: new Date().toISOString()
    };
    
    const newPlaylists = [...playlists, newPlaylist];
    savePlaylists(newPlaylists);
    setNewPlaylistName("");
    setIsSaveDialogOpen(false);
  }, [playlists, getCurrentSettings, savePlaylists]);

  const updateCurrentPlaylist = useCallback(() => {
    if (currentPlaylistIndex < 0 || currentPlaylistIndex >= playlists.length) return;
    
    const updatedPlaylist: PlaylistItem = {
      ...playlists[currentPlaylistIndex],
      ...getCurrentSettings()
    };
    
    const newPlaylists = [...playlists];
    newPlaylists[currentPlaylistIndex] = updatedPlaylist;
    savePlaylists(newPlaylists);
  }, [currentPlaylistIndex, playlists, getCurrentSettings, savePlaylists]);

  const loadPlaylist = useCallback((playlist: PlaylistItem, index?: number) => {
    // Load all settings immediately - don't stop playback, let the useEffects handle the transitions
    setTimeSignature(playlist.timeSignature);
    setTempo(playlist.tempo);
    setDisplayTempo(playlist.tempo);
    setTempoInput(playlist.tempo.toString());
    tempoRef.current = playlist.tempo;
    timeSignatureRef.current = playlist.timeSignature;
    setAccentFirstBeat(playlist.accentFirstBeat);
    accentFirstBeatRef.current = playlist.accentFirstBeat;
    setSubdivision(playlist.subdivision);
    subdivisionRef.current = playlist.subdivision;
    setVoiceSubdivision(playlist.voiceSubdivision);
    voiceSubdivisionRef.current = playlist.voiceSubdivision;
    setUseClick(playlist.useClick);
    setUseVoice(playlist.useVoice);
    setIsIncreasingTempo(playlist.isIncreasingTempo);
    setStartTempo(playlist.startTempo);
    setEndTempo(playlist.endTempo);
    setDuration(playlist.duration);
    
    // Reset start time for increasing tempo when switching playlists
    if (playlist.isIncreasingTempo && audioContextRef.current) {
      startTimeRef.current = audioContextRef.current.currentTime;
      // Also set the current tempo to the start tempo for immediate display
      setCurrentTempo(playlist.startTempo);
      tempoRef.current = playlist.startTempo;
    }
    
    // Update current playlist index
    if (index !== undefined) {
      setCurrentPlaylistIndex(index);
    } else {
      // Find the index if not provided
      const foundIndex = playlists.findIndex(p => p.id === playlist.id);
      setCurrentPlaylistIndex(foundIndex);
    }
    
    setIsPlaylistDialogOpen(false);

    // If voice is enabled and audio buffers aren't loaded, load them
    if (playlist.useVoice && audioBuffersRef.current.length === 0 && audioContextRef.current) {
      loadAudioFiles();
    }
  }, [loadAudioFiles, playlists]);

  const deletePlaylist = useCallback((id: string) => {
    const newPlaylists = playlists.filter(p => p.id !== id);
    savePlaylists(newPlaylists);
    // Reset current index if we deleted the current playlist
    if (currentPlaylistIndex >= newPlaylists.length) {
      setCurrentPlaylistIndex(-1);
    }
  }, [playlists, savePlaylists, currentPlaylistIndex]);

  const skipToNextPlaylist = useCallback(() => {
    if (playlists.length === 0) return;
    const nextIndex = (currentPlaylistIndex + 1) % playlists.length;
    loadPlaylist(playlists[nextIndex], nextIndex);
  }, [playlists, currentPlaylistIndex, loadPlaylist]);

  const skipToPreviousPlaylist = useCallback(() => {
    if (playlists.length === 0) return;
    const prevIndex = currentPlaylistIndex <= 0 ? playlists.length - 1 : currentPlaylistIndex - 1;
    loadPlaylist(playlists[prevIndex], prevIndex);
  }, [playlists, currentPlaylistIndex, loadPlaylist]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedIndex(-1);
      return;
    }

    const newPlaylists = [...playlists];
    const draggedPlaylist = newPlaylists[draggedIndex];
    
    // Remove the dragged item
    newPlaylists.splice(draggedIndex, 1);
    
    // Insert at the new position
    newPlaylists.splice(dropIndex, 0, draggedPlaylist);
    
    // Update current playlist index if necessary
    let newCurrentIndex = currentPlaylistIndex;
    if (currentPlaylistIndex === draggedIndex) {
      // The current playlist was moved
      newCurrentIndex = dropIndex;
    } else if (currentPlaylistIndex > draggedIndex && currentPlaylistIndex <= dropIndex) {
      // Current playlist shifted up
      newCurrentIndex = currentPlaylistIndex - 1;
    } else if (currentPlaylistIndex < draggedIndex && currentPlaylistIndex >= dropIndex) {
      // Current playlist shifted down
      newCurrentIndex = currentPlaylistIndex + 1;
    }
    
    setCurrentPlaylistIndex(newCurrentIndex);
    savePlaylists(newPlaylists);
    setDraggedIndex(-1);
  }, [draggedIndex, playlists, currentPlaylistIndex, savePlaylists]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(-1);
  }, []);

  // Update the calculateCurrentTempo function
  const calculateCurrentTempo = useCallback(() => {
    if (!isIncreasingTempo || !audioContextRef.current) return tempoRef.current;

    const elapsedTime =
      (audioContextRef.current.currentTime - startTimeRef.current) / 60; // Convert to minutes
    const progress = Math.min(elapsedTime / duration, 1);
    return Math.round(startTempo + progress * (endTempo - startTempo));
  }, [isIncreasingTempo, startTempo, endTempo, duration]);

  const scheduleCompound68 = useCallback(() => {
    if (!audioContextRef.current) return;

    const currentTime = audioContextRef.current.currentTime;
    const beatsPerMeasure = 6;

    while (nextNoteTimeRef.current < currentTime + 0.1) {
      const beatInMeasure = currentBeatRef.current % beatsPerMeasure;
      const isAccentedBeat =
        (beatInMeasure === 0 || beatInMeasure === 3) &&
        accentFirstBeatRef.current;

      if (nextNoteTimeRef.current >= nextBeatTimeRef.current) {
        const scheduleTime = Math.max(
          nextNoteTimeRef.current,
          currentTime + 0.1
        );

        if (useClick) {
          const frequency = isAccentedBeat ? 1000 : 600;
          createClickSound(scheduleTime, frequency);
        }

        if (useVoice && audioBuffersRef.current.length > 0) {
          if (beatInMeasure === 0) {
            playVoice(scheduleTime, 0); // Play "1"
          } else if (beatInMeasure === 3) {
            playVoice(scheduleTime, 1); // Play "2"
          } else if (subdivisionRef.current === "1/3") {
            if (beatInMeasure === 1 || beatInMeasure === 4) {
              playSubdivision(scheduleTime, 1, 3); // "ee"
            } else if (beatInMeasure === 2 || beatInMeasure === 5) {
              playSubdivision(scheduleTime, 2, 3); // "ah"
            }
          }
        }

        if (currentTime - lastUpdateTimeRef.current >= 1 / 60) {
          setActiveBeat(beatInMeasure);
          lastUpdateTimeRef.current = currentTime;
        }

        currentBeatRef.current++;
        nextBeatTimeRef.current += 60.0 / tempoRef.current;
      }

      nextNoteTimeRef.current += 60.0 / tempoRef.current;
    }
    schedulerIdRef.current = requestAnimationFrame(scheduleCompound68);
  }, [createClickSound, playVoice, playSubdivision, useClick, useVoice]);

  // Update the scheduleClick function
  const scheduleClick = useCallback(() => {
    if (!audioContextRef.current) return;

    const currentTime = audioContextRef.current.currentTime;
    const [beatsPerMeasure, beatUnit] = timeSignatureRef.current
      .split("/")
      .map(Number);

    const subCount =
      subdivisionRef.current === "1"
        ? 1
        : subdivisionRef.current === "1/2"
        ? 2
        : subdivisionRef.current === "1/3"
        ? 3
        : 4;

    while (nextNoteTimeRef.current < currentTime + 0.1) {
      const currentTempo = calculateCurrentTempo();
      const beatDuration = 60.0 / currentTempo;
      const subBeatDuration = beatDuration / subCount;

      const beatInMeasure =
        Math.floor(currentBeatRef.current / subCount) % beatsPerMeasure;
      const subBeat = currentBeatRef.current % subCount;
      const isAccentedBeat = beatInMeasure === 0 && accentFirstBeatRef.current;

      if (nextNoteTimeRef.current <= currentTime) {
        // If we've passed the scheduled time, update to the next beat
        currentBeatRef.current++;
        nextNoteTimeRef.current += subBeatDuration;
        if (subBeat === subCount - 1) {
          nextBeatTimeRef.current = nextNoteTimeRef.current;
        }
      } else {
        const scheduleTime = nextNoteTimeRef.current;

        if (useClick) {
          if (subBeat === 0) {
            const frequency = isAccentedBeat ? 1000 : 600;
            createClickSound(scheduleTime, frequency);
          } else {
            createSubdivisionClick(
              scheduleTime,
              subBeat,
              subCount,
              isAccentedBeat
            );
          }
        }

        if (useVoice && audioBuffersRef.current.length > 0) {
          if (subBeat === 0) {
            playVoice(scheduleTime, beatInMeasure);
          } else if (voiceSubdivisionRef.current) {
            playSubdivision(scheduleTime, subBeat, subCount);
          }
        }

        if (subBeat === 0) {
          if (currentTime - lastUpdateTimeRef.current >= 1 / 60) {
            setActiveBeat(beatInMeasure);
            lastUpdateTimeRef.current = currentTime;
          }
        }

        currentBeatRef.current++;
        nextNoteTimeRef.current += subBeatDuration;
        if (subBeat === subCount - 1) {
          nextBeatTimeRef.current = nextNoteTimeRef.current;
        }
      }
    }
    schedulerIdRef.current = requestAnimationFrame(scheduleClick);
  }, [
    createClickSound,
    createSubdivisionClick,
    playVoice,
    playSubdivision,
    useClick,
    useVoice,
    calculateCurrentTempo,
    voiceSubdivisionRef,
  ]);

  // Create a Web Audio API wake lock function to prevent audio context from suspending
  const createWebAudioWakeLock = useCallback(() => {
    if (!audioContextRef.current) return;

    // First, clean up any existing wake lock source
    if (wakeLockSourceRef.current) {
      try {
        wakeLockSourceRef.current.stop();
      } catch (e) { /* Ignore errors stopping already stopped node */ }
      wakeLockSourceRef.current.disconnect();
      wakeLockSourceRef.current = null;
    }
    if (wakeLockGainRef.current) {
      wakeLockGainRef.current.disconnect();
      wakeLockGainRef.current = null;
    }

    // Create a silent buffer (very short)
    const buffer = audioContextRef.current.createBuffer(
      1, // mono
      1, // 1 sample frame (extremely short)
      audioContextRef.current.sampleRate
    );

    // Create a source node
    wakeLockSourceRef.current = audioContextRef.current.createBufferSource();
    wakeLockSourceRef.current.buffer = buffer;
    wakeLockSourceRef.current.loop = true; // Loop it continuously

    // Create a gain node with zero gain (silence)
    wakeLockGainRef.current = audioContextRef.current.createGain();
    wakeLockGainRef.current.gain.setValueAtTime(0.0, audioContextRef.current.currentTime); // Ensure it's silent

    // Connect the source to the gain node, and the gain node to the destination
    wakeLockSourceRef.current.connect(wakeLockGainRef.current);
    wakeLockGainRef.current.connect(audioContextRef.current.destination);

    // Start the source node
    try {
      wakeLockSourceRef.current.start();
      console.log('Web Audio API wake lock started');
    } catch (e) {
      console.error('Error starting Web Audio wake lock:', e);
    }

  }, []);

  // Stop the Web Audio API wake lock
  const stopWebAudioWakeLock = useCallback(() => {
    if (wakeLockSourceRef.current) {
      try {
        wakeLockSourceRef.current.stop();
         console.log('Web Audio API wake lock stopped');
      } catch (e) { /* Ignore errors */ }
      wakeLockSourceRef.current.disconnect();
      wakeLockSourceRef.current = null;
    }
    if (wakeLockGainRef.current) {
      wakeLockGainRef.current.disconnect();
      wakeLockGainRef.current = null;
    }
  }, []);

  // Update the startStop function
  const startStop = useCallback(() => {
    if (isPlaying) {
      // Stop logic
      if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
      setIsPlaying(false);
      setActiveBeat(-1);
      stopWebAudioWakeLock();
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
          console.log('AudioContext closed');
          audioContextRef.current = null;
        }).catch(e => console.error('Error closing AudioContext:', e));
      }
      // Update MediaSession state on manual stop
      if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
      }
    } else {
      // Start logic
      const AudioContextClass = window.AudioContext || 
        (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContextClass();
          console.log('AudioContext created or recreated');
      }
      
      audioContextRef.current.resume().then(() => {
          console.log('AudioContext resumed successfully');
          createWebAudioWakeLock();
          
          // Load audio files if voice is enabled
          if (useVoice) {
            loadAudioFiles();
          }

          // Setup MediaSession API - Corrected Handlers
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'DrumClick',
              artist: 'Metronome',
              album: 'DrumClick.app',
            });
            // Handlers should set state, not call startStop directly
            navigator.mediaSession.setActionHandler('play', () => {
                if (!isPlaying) setIsPlaying(true); // Trigger start via state change
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (isPlaying) setIsPlaying(false); // Trigger stop via state change
            });
            navigator.mediaSession.setActionHandler('stop', () => {
                if (isPlaying) setIsPlaying(false); // Trigger stop via state change
            });
            navigator.mediaSession.playbackState = 'playing';
          }

          // Schedule the first beat
          const currentTime = audioContextRef.current!.currentTime;
          nextNoteTimeRef.current = currentTime + 0.1;
          nextBeatTimeRef.current = nextNoteTimeRef.current;
          lastUpdateTimeRef.current = currentTime;
          currentBeatRef.current = 0;
          setActiveBeat(0);

          // Set tempo
          if (isIncreasingTempo) {
            startTimeRef.current = currentTime;
            tempoRef.current = startTempo;
            setCurrentTempo(startTempo);
          } else {
            tempoRef.current = tempo;
            setCurrentTempo(tempo);
          }

          // Start the scheduler
          if (timeSignature === "6/8 (Compound)") {
            scheduleCompound68();
          } else {
            scheduleClick();
          }
          setIsPlaying(true); // Set playing state *after* setup
          
      }).catch(e => {
        console.error('Failed to resume AudioContext:', e);
        setIsPlaying(false); 
      });
    }
  }, [isPlaying, stopWebAudioWakeLock, createWebAudioWakeLock, loadAudioFiles, scheduleClick, scheduleCompound68, timeSignature, isIncreasingTempo, startTempo, tempo]);

  useEffect(() => {
    tempoRef.current = tempo;
    timeSignatureRef.current = timeSignature;
    accentFirstBeatRef.current = accentFirstBeat;
    setTempoInput(tempo.toString());

    if (isPlaying) {
      // Reset the current beat when time signature changes
      currentBeatRef.current = 0;
      setActiveBeat(0);

      // Cancel the existing scheduler
      if (schedulerIdRef.current) {
        cancelAnimationFrame(schedulerIdRef.current);
      }

      // Start the appropriate scheduler based on the new time signature
      if (timeSignature === "6/8 (Compound)") {
        scheduleCompound68();
      } else {
        scheduleClick();
      }

      // Adjust nextBeatTimeRef when tempo changes
      if (tempoRef.current !== tempo) {
        const currentTime = audioContextRef.current!.currentTime;
        const timeSinceLastBeat = currentTime - nextBeatTimeRef.current;
        const newBeatDuration = 60.0 / tempo;
        nextBeatTimeRef.current =
          currentTime + newBeatDuration - timeSinceLastBeat;
      }
    }
  }, [
    tempo,
    timeSignature,
    accentFirstBeat,
    isPlaying,
    scheduleClick,
    scheduleCompound68,
  ]);

  useEffect(() => {
    return () => {
      if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const renderLights = () => {
    const beatsPerMeasure =
      timeSignature === "6/8 (Compound)"
        ? 6
        : parseInt(timeSignature.split("/")[0]);
    return Array.from({ length: beatsPerMeasure }, (_, i) => (
      <div
        key={i}
        className={`w-8 h-8 rounded-full ${
          i === activeBeat
            ? ((timeSignature === "6/8 (Compound)" && (i === 0 || i === 3)) ||
                (timeSignature !== "6/8 (Compound)" && i === 0)) &&
              accentFirstBeat
              ? "bg-yellow-400" // Brighter yellow for accented beats
              : "bg-green-500" // Green for non-accented active beats
            : "bg-gray-300" // Gray for inactive beats
        } transition-colors duration-100`}
      ></div>
    ));
  };

  // Update the useEffect hook for tempo changes
  useEffect(() => {
    if (isPlaying && isIncreasingTempo) {
      const updateTempo = () => {
        const newTempo = calculateCurrentTempo();
        setDisplayTempo(newTempo);
        setTempoInput(newTempo.toString());
        tempoRef.current = newTempo;
      };

      const intervalId = setInterval(updateTempo, 100); // Update frequently

      return () => clearInterval(intervalId);
    } else {
      setDisplayTempo(tempo);
      tempoRef.current = tempo;
    }
  }, [isPlaying, isIncreasingTempo, calculateCurrentTempo, tempo]);

  // Update the handleTempoInputChange function
  const handleTempoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempoInput(value);

    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue) && numericValue >= 40 && numericValue <= 300) {
      setTempo(numericValue);
      setDisplayTempo(numericValue);
      if (!isIncreasingTempo) {
        tempoRef.current = numericValue;
      }
    }
  };

  // Update the handleTempoInputBlur function
  const handleTempoInputBlur = () => {
    const numericValue = parseInt(tempoInput, 10);
    if (isNaN(numericValue) || numericValue < 40) {
      setTempoInput("40");
      setTempo(40);
      setDisplayTempo(40);
      if (!isIncreasingTempo) {
        tempoRef.current = 40;
      }
    } else if (numericValue > 300) {
      setTempoInput("300");
      setTempo(300);
      setDisplayTempo(300);
      if (!isIncreasingTempo) {
        tempoRef.current = 300;
      }
    } else {
      setTempoInput(numericValue.toString());
      setTempo(numericValue);
      setDisplayTempo(numericValue);
      if (!isIncreasingTempo) {
        tempoRef.current = numericValue;
      }
    }
  };

  const toggleClickMode = useCallback((value: boolean) => {
    setUseClick(value);
    // Immediately update the ref so it takes effect during playback
    if (isPlaying) {
      // We need to let the useEffect handle the scheduler restart
    }
  }, [isPlaying]);

  const toggleVoiceMode = useCallback(
    (value: boolean) => {
      setUseVoice(value);
      if (
        value &&
        audioBuffersRef.current.length === 0 &&
        audioContextRef.current
      ) {
        loadAudioFiles().then(() => {
          // Force a re-render to use the newly loaded audio buffers
          setUseVoice((prev) => !prev);
          setUseVoice(value);
        });
      }
      // Immediately update during playback
      if (isPlaying) {
        // We need to let the useEffect handle the scheduler restart
      }
    },
    [loadAudioFiles, isPlaying]
  );

  useEffect(() => {
    if (isPlaying) {
      // Load audio files if voice is enabled and not loaded
      if (useVoice && audioBuffersRef.current.length === 0 && audioContextRef.current) {
        loadAudioFiles().then(() => {
          // After loading, restart the scheduler
          if (schedulerIdRef.current) {
            cancelAnimationFrame(schedulerIdRef.current);
          }
          // Reset the beat to avoid audio glitches
          const currentTime = audioContextRef.current?.currentTime;
          if (currentTime) {
            nextNoteTimeRef.current = currentTime + 0.1;
            nextBeatTimeRef.current = nextNoteTimeRef.current;
            currentBeatRef.current = 0;
            setActiveBeat(0);
          }
          // Restart the scheduler with the new settings
          if (timeSignature === "6/8 (Compound)") {
            scheduleCompound68();
          } else {
            scheduleClick();
          }
        });
      } else {
        // Cancel the existing scheduler
        if (schedulerIdRef.current) {
          cancelAnimationFrame(schedulerIdRef.current);
        }
        // Reset the beat to avoid audio glitches when toggling modes
        const currentTime = audioContextRef.current?.currentTime;
        if (currentTime) {
          nextNoteTimeRef.current = currentTime + 0.1;
          nextBeatTimeRef.current = nextNoteTimeRef.current;
          currentBeatRef.current = 0;
          setActiveBeat(0);
        }
        // Restart the scheduler with the new settings
        if (timeSignature === "6/8 (Compound)") {
          scheduleCompound68();
        } else {
          scheduleClick();
        }
      }
    }
  }, [useClick, useVoice, isPlaying, scheduleClick, scheduleCompound68, timeSignature, loadAudioFiles]);

  useEffect(() => {
    subdivisionRef.current = subdivision;
  }, [subdivision]);

  useEffect(() => {
    voiceSubdivisionRef.current = voiceSubdivision;
  }, [voiceSubdivision]);

  // Add this useEffect near your other useEffect hooks
  useEffect(() => {
    if (timeSignature === "6/8 (Compound)") {
      if (subdivision === "1/2" || subdivision === "1/4") {
        setSubdivision("1/3");
      }
    } else if (timeSignature === "6/8") {
      if (subdivision === "1/3") {
        setSubdivision("1/2");
      }
    }
  }, [timeSignature, subdivision]);

  // Modify the visibilitychange handler - primarily for resuming context if needed
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!audioContextRef.current || !isPlaying) return;

      if (document.visibilityState === 'hidden') {
         // Optional: Could potentially stop the WebAudioWakeLock here to save battery,
         // but might risk suspension. Let's leave it running for now.
      } else if (document.visibilityState === 'visible') {
        // When tab becomes visible, ensure context is running
        if (audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
            console.log('AudioContext resumed on visibility change');
            // Re-create wake lock just in case it got implicitly stopped
            // (though ideally it shouldn't if context was just suspended)
            // createWebAudioWakeLock(); 
          } catch (error) {
            console.error('Failed to resume AudioContext on visibility change:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add listener for AudioContext state changes
    let contextStateListener = () => {};
    if (audioContextRef.current) {
      contextStateListener = async () => {
        if (!audioContextRef.current) return;
        console.log('AudioContext state changed to:', audioContextRef.current.state);
        if (audioContextRef.current.state === 'suspended' && isPlaying) {
          console.warn('AudioContext suspended while playing! Attempting to resume...');
          try {
             await audioContextRef.current.resume();
             console.log('AudioContext resumed automatically after suspend event.');
             // Re-ensure wake lock is running
             // createWebAudioWakeLock();
          } catch (error) {
             console.error('Failed to auto-resume AudioContext after suspend event:', error);
          }
        } else if (audioContextRef.current.state === 'closed') {
            console.log('AudioContext is closed.');
            // If it closed unexpectedly while playing, stop the metronome state
            if (isPlaying) {
                setIsPlaying(false);
                setActiveBeat(-1);
                stopWebAudioWakeLock();
                if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
            }
        }
      };
      audioContextRef.current.addEventListener('statechange', contextStateListener);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (audioContextRef.current) {
        audioContextRef.current.removeEventListener('statechange', contextStateListener);
      }
    };
  // We need audioContextRef.current in deps to re-attach listener if context is recreated
  }, [isPlaying, createWebAudioWakeLock]); 

  // Update MediaSession state
  useEffect(() => {
    if ('mediaSession' in navigator) {
       navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Load playlists on component mount
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  return (
    <AudioWakeLock isPlaying={isPlaying}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4 relative">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              DrumClick
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="settings" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="settings">Metronome</TabsTrigger>
                <TabsTrigger value="advanced">Settings</TabsTrigger>
                <TabsTrigger value="playlists">Playlists</TabsTrigger>
              </TabsList>
              <TabsContent value="settings" className="space-y-4">
                <div>
                  <Label htmlFor="timeSignature" className="text-sm font-medium">
                    Time Signature
                  </Label>
                  <Select value={timeSignature} onValueChange={setTimeSignature}>
                    <SelectTrigger id="timeSignature">
                      <SelectValue placeholder="Select time signature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2/4">2/4</SelectItem>
                      <SelectItem value="3/4">3/4</SelectItem>
                      <SelectItem value="4/4">4/4</SelectItem>
                      <SelectItem value="5/4">5/4</SelectItem>
                      <SelectItem value="6/8">6/8</SelectItem>
                      <SelectItem value="6/8 (Compound)">
                        6/8 (Compound)
                      </SelectItem>
                      <SelectItem value="7/8">7/8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tempo" className="text-sm font-medium">
                    Tempo (BPM)
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="tempo"
                      min={40}
                      max={300}
                      step={1}
                      value={[displayTempo]}
                      onValueChange={(value) => {
                        if (!isIncreasingTempo) {
                          setTempo(value[0]);
                          setDisplayTempo(value[0]);
                          setTempoInput(value[0].toString());
                          tempoRef.current = value[0];
                        }
                      }}
                      className="flex-grow"
                      disabled={isIncreasingTempo}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempoInput}
                      onChange={handleTempoInputChange}
                      onBlur={handleTempoInputBlur}
                      className="w-20"
                      disabled={isIncreasingTempo}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="advanced" className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accent-mode" className="text-sm font-medium">
                    Accents
                  </Label>
                  <Switch
                    id="accent-mode"
                    checked={accentFirstBeat}
                    onCheckedChange={setAccentFirstBeat}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdivision" className="text-sm font-medium">
                    Subdivision
                  </Label>
                  <RadioGroup
                    id="subdivision"
                    value={subdivision}
                    onValueChange={(value) =>
                      setSubdivision(value as "1" | "1/2" | "1/3" | "1/4")
                    }
                    className="flex space-x-2"
                    disabled={!useClick && !useVoice}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1" id="r1" />
                      <Label htmlFor="r1">1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="1/2"
                        id="r2"
                        disabled={timeSignature === "6/8 (Compound)"}
                      />
                      <Label
                        htmlFor="r2"
                        className={
                          timeSignature === "6/8 (Compound)"
                            ? "text-gray-400"
                            : ""
                        }
                      >
                        1/2
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1/3" id="r3" />
                      <Label htmlFor="r3">1/3</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="1/4"
                        id="r4"
                        disabled={timeSignature === "6/8 (Compound)"}
                      />
                      <Label
                        htmlFor="r4"
                        className={
                          timeSignature === "6/8 (Compound)"
                            ? "text-gray-400"
                            : ""
                        }
                      >
                        1/4
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="voice-subdivision"
                    className="text-sm font-medium"
                  >
                    Voice Subdivision
                  </Label>
                  <Switch
                    id="voice-subdivision"
                    checked={voiceSubdivision}
                    onCheckedChange={setVoiceSubdivision}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="increasing-tempo"
                    className="text-sm font-medium"
                  >
                    Increasing Tempo
                  </Label>
                  <Switch
                    id="increasing-tempo"
                    checked={isIncreasingTempo}
                    onCheckedChange={setIsIncreasingTempo}
                  />
                </div>
                {isIncreasingTempo && (
                  <>
                    <div>
                      <Label
                        htmlFor="start-tempo"
                        className="text-sm font-medium"
                      >
                        Start Tempo
                      </Label>
                      <Input
                        id="start-tempo"
                        type="number"
                        value={startTempo}
                        onChange={(e) => setStartTempo(Number(e.target.value))}
                        min={40}
                        max={300}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-tempo" className="text-sm font-medium">
                        End Tempo
                      </Label>
                      <Input
                        id="end-tempo"
                        type="number"
                        value={endTempo}
                        onChange={(e) => setEndTempo(Number(e.target.value))}
                        min={40}
                        max={300}
                      />
                    </div>
                    <div>
                      <Label htmlFor="duration" className="text-sm font-medium">
                        Duration (minutes)
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        min={1}
                        max={60}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="playlists" className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Saved Presets</Label>
                  <div className="flex space-x-2">
                    {/* Update button - only show when a playlist is loaded */}
                    {currentPlaylistIndex >= 0 && currentPlaylistIndex < playlists.length && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={updateCurrentPlaylist}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Update "{playlists[currentPlaylistIndex].name}"
                      </Button>
                    )}
                    
                    {/* Save Current button - always available */}
                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Save className="mr-2 h-4 w-4" />
                          Save Current
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Current Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="playlist-name">Preset Name</Label>
                            <Input
                              id="playlist-name"
                              value={newPlaylistName}
                              onChange={(e) => setNewPlaylistName(e.target.value)}
                              placeholder="Enter preset name..."
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsSaveDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => saveCurrentAsPlaylist(newPlaylistName)}
                              disabled={!newPlaylistName.trim()}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                {playlists.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <List className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No saved presets yet</p>
                    <p className="text-sm">Save your current settings to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {playlists.map((playlist, index) => (
                      <div
                        key={playlist.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-all ${
                          index === currentPlaylistIndex ? 'bg-accent border-primary' : ''
                        } ${
                          draggedIndex === index ? 'opacity-50 scale-95' : ''
                        }`}
                      >
                        <div 
                          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div 
                          className="flex-1 cursor-pointer" 
                          onClick={() => loadPlaylist(playlist, index)}
                        >
                          <div className="font-medium">{playlist.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {playlist.timeSignature} • {playlist.tempo} BPM
                            {playlist.isIncreasingTempo && ` • ${playlist.startTempo}-${playlist.endTempo} BPM`}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlaylist(playlist.id);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="text-center">
              <div className="text-6xl font-bold mb-4">{displayTempo}</div>
              <div className="flex justify-center space-x-4 py-4">
                {renderLights()}
              </div>
            </div>

            <div className="flex justify-between space-x-4">
              <Button
                variant="outline"
                size="sm"
                className={`flex-1 ${
                  useClick
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => toggleClickMode(!useClick)}
              >
                <Music className="mr-2 h-4 w-4" />
                Click
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`flex-1 ${
                  useVoice
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => toggleVoiceMode(!useVoice)}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                Voice
              </Button>
            </div>

            <Button onClick={startStop} className="w-full" size="lg">
              {isPlaying ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Play
                </>
              )}
            </Button>

            {/* Playlist navigation buttons - only show if there are playlists */}
            {playlists.length > 0 && (
              <div className="flex justify-center space-x-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={skipToPreviousPlaylist}
                  className="flex-1"
                  disabled={playlists.length <= 1}
                >
                  <SkipBack className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={skipToNextPlaylist}
                  className="flex-1"
                  disabled={playlists.length <= 1}
                >
                  Next
                  <SkipForward className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Show current playlist name if one is selected */}
            {currentPlaylistIndex >= 0 && currentPlaylistIndex < playlists.length && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                Playing: <span className="font-medium">{playlists[currentPlaylistIndex].name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AudioWakeLock>
  );
}
