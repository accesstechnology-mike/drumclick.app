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
import { Play, Square } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

  const scheduleClick = useCallback(() => {
    const currentTime = audioContextRef.current!.currentTime;
    const beatsPerMeasure = parseInt(timeSignatureRef.current.split("/")[0]);

    while (nextNoteTimeRef.current < currentTime + 0.1) {
      const isFirstBeat = currentBeatRef.current % beatsPerMeasure === 0;
      
      if (nextNoteTimeRef.current >= nextBeatTimeRef.current) {
        const scheduleTime = Math.max(nextNoteTimeRef.current, currentTime + 0.1);
        const frequency = (isFirstBeat && accentFirstBeatRef.current) ? 1000 : 600;
        createClickSound(scheduleTime, frequency);
        
        if (currentTime - lastUpdateTimeRef.current >= 1 / 60) {
          setActiveBeat(currentBeatRef.current % beatsPerMeasure);
          lastUpdateTimeRef.current = currentTime;
        }

        currentBeatRef.current++;
        nextBeatTimeRef.current += 60.0 / tempoRef.current;
      }

      nextNoteTimeRef.current += 60.0 / tempoRef.current;
    }
    schedulerIdRef.current = requestAnimationFrame(scheduleClick);
  }, [createClickSound]);

  const startStop = () => {
    if (isPlaying) {
      if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
      setIsPlaying(false);
      setActiveBeat(-1);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } else {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const currentTime = audioContextRef.current.currentTime;
      
      // Schedule the first beat slightly in the future
      nextNoteTimeRef.current = currentTime + 0.1;
      nextBeatTimeRef.current = nextNoteTimeRef.current;
      lastUpdateTimeRef.current = currentTime;
      currentBeatRef.current = 0;
      setActiveBeat(0); // Change this line from -1 to 0
      scheduleClick();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    tempoRef.current = tempo;
    timeSignatureRef.current = timeSignature;
    accentFirstBeatRef.current = accentFirstBeat;
    setTempoInput(tempo.toString()); // Update tempoInput when tempo changes

    if (isPlaying) {
      // Reset the current beat when time signature changes
      if (timeSignatureRef.current !== timeSignature) {
        currentBeatRef.current = 0;
        setActiveBeat(0);
      }
      // Adjust nextBeatTimeRef when tempo changes
      if (tempoRef.current !== tempo) {
        const currentTime = audioContextRef.current!.currentTime;
        const timeSinceLastBeat = currentTime - nextBeatTimeRef.current;
        const newBeatDuration = 60.0 / tempo;
        nextBeatTimeRef.current = currentTime + newBeatDuration - timeSinceLastBeat;
      }
    }
  }, [tempo, timeSignature, accentFirstBeat, isPlaying]);

  useEffect(() => {
    return () => {
      if (schedulerIdRef.current) cancelAnimationFrame(schedulerIdRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const renderLights = () => {
    const beatsPerMeasure = parseInt(timeSignature.split("/")[0]);
    return Array.from({ length: beatsPerMeasure }, (_, i) => (
      <div
        key={i}
        className={`w-4 h-4 rounded-full ${
          i === activeBeat ? "bg-green-500" : "bg-gray-300"
        } transition-colors duration-100`}
      ></div>
    ));
  };

  const handleTempoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempoInput(value);

    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      if (numericValue >= 40 && numericValue <= 300) {
        setTempo(numericValue);
      }
    }
  };

  const handleTempoInputBlur = () => {
    if (tempoInput === '' || parseInt(tempoInput, 10) < 40) {
      setTempoInput('40');
      setTempo(40);
    } else if (parseInt(tempoInput, 10) > 300) {
      setTempoInput('300');
      setTempo(300);
    } else {
      setTempoInput(tempo.toString());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Click Track Generator
        </h1>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="timeSignature"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Time Signature
            </label>
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
                <SelectItem value="7/8">7/8</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="tempo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tempo (BPM)
            </label>
            <div className="flex items-center space-x-2">
              <Slider
                id="tempo"
                min={40}
                max={300}
                step={1}
                value={[tempo]}
                onValueChange={(value) => {
                  setTempo(value[0]);
                  setTempoInput(value[0].toString()); // Update tempoInput when slider changes
                }}
                className="w-full"
              />
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={tempoInput}
                onChange={handleTempoInputChange}
                onBlur={handleTempoInputBlur}
                className="w-20"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="accent-mode"
              checked={accentFirstBeat}
              onCheckedChange={setAccentFirstBeat}
            />
            <Label htmlFor="accent-mode">Accent First Beat</Label>
          </div>

          <div className="flex justify-center space-x-2 mb-4">
            {renderLights()}
          </div>

          <Button
            onClick={startStop}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isPlaying ? (
              <Square className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {isPlaying ? "Stop" : "Play"}
          </Button>
        </div>
      </div>
    </div>
  );
}
