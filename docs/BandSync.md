# DrumClick – Real-Time Band Sync

The Band-Sync layer lets multiple devices hear the **exact same** click-track in perfect time.

## 1  How it works

1.   One device becomes **Leader** and presses "Generate Code".  A short
     alphanumeric ID (provided by the free PeerJS cloud) is shown.
2.   Other devices choose **Member**, enter that code and press "Join".
3.   Internally we use a WebRTC Data-Channel (via [PeerJS](https://peerjs.com))
     for small control messages:

     • `ping` / `pong` — round-trip measures network latency and the  
       current **AudioContext** clocks on each device.  A rolling average of
       the last 8 samples gives a stable clock-skew value.

     • `start` — sent by the Leader when they press Play.  Contains the exact
       Leader `AudioContext.currentTime` at which the first beat will sound as
       well as tempo & time-signature.  Each Member converts this host time
       → local time using the averaged skew and schedules playback, usually
       <10 ms off.

     • `stop` — halts playback on all clients.

4.   If the connection drops the hook automatically retries every 2 s.

## 2  Public React Hook

```ts
const bandSync = useBandSync(role); // role = 'leader' | 'member'
```

Exposed fields:

| Field | Description |
|-------|-------------|
| `ready`      | Data-channel is open & usable |
| `status`     | `'idle' | 'connecting' | 'connected' | 'error'` |
| `sessionId`  | The code you share when Leader |
| `startHosting()` | Leader → obtain a code |
| `joinSession(id)` | Member → connect with code |
| `startTransport(delay, tempo, sig)` | Leader → broadcast *play* |
| `stopTransport()` | Leader → broadcast *stop* |
| `onStart(cb)` | Subscribe to remote *play* |
| `onStop(cb)`  | Subscribe to remote *stop* |
| `convertHostTime(t)` | Convert host `AudioContext` time → local |

## 3  Accuracy tips

• Use good Wi-Fi; avoid mobile hotspots.  
• Keep devices physically close to the router to reduce jitter.  
• For critical gigs consider wired Ethernet adapters.

## 4  Extending

Things that could be added later:

*  Jitter buffer: average over larger windows & discard outliers.
*  NAT-free hosting: self-host the PeerJS signalling server.
*  UI: per-member latency read-out.

## 5  Usage examples

### Leader component

```tsx
const bandSync = useBandSync('leader');

// UI
<button onClick={() => {
  if (!bandSync.ready) {
    bandSync.startHosting();
    return;
  }
  metronome.start();
  // Broadcast to members after local context scheduled
  bandSync.startTransport(0.1 /* 100 ms */, tempo, signature);
}}>Play</button>
```

### Member component

```tsx
const [code, setCode] = useState('');
const bandSync = useBandSync('member');

useEffect(() => {
  bandSync.onStart(({ startAudioTime, tempo, signature }) => {
    metronome.load({ tempo, signature });
    metronome.playAt(bandSync.convertHostTime(startAudioTime));
  });
}, []);

<button onClick={() => bandSync.joinSession(code)}>Join</button>
```

## 6  Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Members hear click offset / drifting | Wi-Fi jitter, large skew | Ensure good signal, wait ~5 pings for filter to converge |
| "Disconnected. Retrying…" keeps flashing | NAT traversal failed | Try different network or self-host PeerJS server |
| No audio after permissions prompt | Browser blocked AudioContext until user gesture | Click anywhere on screen to unlock audio |

## 7  Sync-quality indicator

When connected, the UI shows a coloured dot and label derived from jitter (std-dev of clock-skew samples):

| Quality     | Jitter (σ, ms) | Colour |
|-------------|----------------|--------|
| excellent   | < 3            | Green  |
| good        | < 7            | Yellow |
| poor        | ≥ 7            | Red    |

If you see "poor" for more than a few seconds, reduce Wi-Fi congestion or move closer to the router.

## 8  Reconnection logic

Members auto-retry with exponential back-off: 2 s → 4 s → 8 s → … up to 30 s, plus 0–30 % random jitter to avoid herd effects.
The countdown is visible in the UI.  Back-off resets instantly when the DataChannel is re-established.

---
© 2025 DrumClick