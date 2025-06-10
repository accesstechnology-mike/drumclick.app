'use client';

import { Dispatch, SetStateAction, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RefreshCw, Save, List, GripVertical, Play, Trash2, SkipBack, SkipForward } from 'lucide-react';

interface PlaylistItem {
  id: string;
  name: string;
  timeSignature: string;
  tempo: number;
  accentFirstBeat: boolean;
  subdivision: '1' | '1/2' | '1/3' | '1/4';
  voiceSubdivision: boolean;
  swingMode: boolean;
  useClick: boolean;
  useVoice: boolean;
  isIncreasingTempo: boolean;
  startTempo: number;
  endTempo: number;
  duration: number;
  flashApp: boolean;
  createdAt: string;
}

interface PlaylistPanelProps {
  playlists: PlaylistItem[];
  currentIndex: number;
  draggedIndex: number;
  newPlaylistName: string;
  setNewPlaylistName: Dispatch<SetStateAction<string>>;
  isSaveDialogOpen: boolean;
  setIsSaveDialogOpen: Dispatch<SetStateAction<boolean>>;
  updateCurrentPlaylist: () => void;
  saveCurrentAsPlaylist: (name: string) => void;
  loadPlaylist: (pl: PlaylistItem, idx: number) => void;
  deletePlaylist: (id: string) => void;
  handleDragStart: (e: React.DragEvent, idx: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, idx: number) => void;
  handleDragEnd: () => void;
  skipPrev: () => void;
  skipNext: () => void;
  containerRef: RefObject<HTMLDivElement>;
}

export default function PlaylistPanel({
  playlists,
  currentIndex,
  draggedIndex,
  newPlaylistName,
  setNewPlaylistName,
  isSaveDialogOpen,
  setIsSaveDialogOpen,
  updateCurrentPlaylist,
  saveCurrentAsPlaylist,
  loadPlaylist,
  deletePlaylist,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  skipPrev,
  skipNext,
  containerRef,
}: PlaylistPanelProps) {
  return (
    <>
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Saved Presets</Label>
        <div className="flex space-x-2">
          {currentIndex >= 0 && currentIndex < playlists.length && (
            <Button variant="outline" size="sm" onClick={updateCurrentPlaylist}>
              <RefreshCw className="mr-2 h-4 w-4" /> Update "{playlists[currentIndex].name}"
            </Button>
          )}

          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" /> Save Current
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
                  <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => saveCurrentAsPlaylist(newPlaylistName)} disabled={!newPlaylistName.trim()}>
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
        <div ref={containerRef} className="space-y-1 flex-1 overflow-y-auto">
          {playlists.map((pl, idx) => (
            <div
              key={pl.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2 border rounded hover:bg-accent transition-all ${
                idx === currentIndex ? 'bg-accent border-primary' : ''
              } ${draggedIndex === idx ? 'opacity-50 scale-95' : ''}`}
            >
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5" onMouseDown={(e) => e.stopPropagation()}>
                <GripVertical className="h-3 w-3" />
              </div>
              <div className="flex-1 cursor-pointer min-w-0" onClick={() => loadPlaylist(pl, idx)}>
                <div className="flex items-center gap-1">
                  <div className="font-medium text-sm truncate">{pl.name}</div>
                  {idx === currentIndex && <Play className="h-3 w-3 text-primary flex-shrink-0" />}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {pl.timeSignature} • {pl.tempo} BPM {pl.isIncreasingTempo && ` • ${pl.startTempo}-${pl.endTempo} BPM`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePlaylist(pl.id);
                }}
                className="text-destructive hover:text-destructive h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {playlists.length > 0 && (
        <div className="flex justify-center space-x-2 mt-4">
          <Button variant="outline" size="sm" onClick={skipPrev} className="flex-1" disabled={playlists.length <= 1}>
            <SkipBack className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={skipNext} className="flex-1" disabled={playlists.length <= 1}>
            Next <SkipForward className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
} 