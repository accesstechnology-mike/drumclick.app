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

---
© 2025 DrumClick