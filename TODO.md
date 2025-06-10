# DrumClick.app - Development Roadmap

## 🚨 CRITICAL PATH: Wake Lock & Audio Reliability Testing

### Phase 0: Wake/Sleep Testing Sprint (DO THIS FIRST!)
- [ ] Implement aggressive Wake Lock API with retry logic
- [ ] Add silent audio loop hack (1-second silent MP3 on repeat)
- [ ] Test video element workaround (black video with embedded audio)
- [ ] Add visibility change handlers + audio context resume
- [ ] Implement fullscreen API as wake lock enhancer
- [ ] Create diagnostic mode showing:
  - Wake lock status
  - Audio context state  
  - Time since last audio suspension
  - Battery optimization warnings

### Testing Protocol:
1. Test on minimum 3 real Android devices (different manufacturers)
2. Run for 30+ minutes continuous
3. Test with screen timeout at 30s, 1min, 5min
4. Test in battery saver mode
5. Test with app backgrounded
6. Document failure rates per device/scenario

### ✅ DECISION MADE:
**Test Results: 12+ minutes diagnostic test successful → PWA IS VIABLE**
**Path: Pure PWA Route (Path A)**

**🚨 CRITICAL FINDING**: Main app wake lock is WEAKER than diagnostics test!
- Diagnostics: Wake lock + silent audio + retry logic ✅ 
- Main app: Basic wake lock only ❌

---

## Path A: Pure PWA Route

### Phase 1: Core Reliability
- [x] ✅ PWA enabled in development
- [x] ✅ Comprehensive wake lock diagnostic test (passed 12+ min)  
- [x] ✅ **UPGRADED**: Main app AudioWakeLock now matches proven diagnostics implementation
- [ ] Fix voice output six + seven timing with beeps
- [ ] Replace Twitter image/meta tags + generate proper logo
- [ ] Store all samples in IndexedDB for offline
- [ ] Add "Install App" prompts and PWA optimization
- [ ] Add multi-strategy audio player (Web Audio + HTML Audio fallback)
- [ ] Implement AudioWorklet for precise timing (where supported)

### Phase 2: Premium Features
- [ ] Auth system (Supabase/Auth0)
- [ ] Stripe/Paddle payment integration
- [ ] Feature flags for free/premium
- [ ] Premium features:
  - [ ] Advanced polyrhythms
  - [ ] Custom sound packs
  - [ ] Cloud sync settings
  - [ ] Multi-user sessions (Phase 3)

---

## Path B: Hybrid Route (If Wake Lock Unreliable)

### Phase 1: Capacitor Setup
- [ ] Wrap existing app in Capacitor
- [ ] Add native wake lock plugin
- [ ] Add background audio plugin
- [ ] Test deployment pipeline for both web + native
- [ ] Create build variants:
  - Web (pure PWA)
  - Android (Capacitor + Play Store)

### Phase 2: Dual Distribution
- [ ] Set up TWA for Play Store (minimal effort path)
- [ ] OR full Capacitor app with native plugins
- [ ] Implement Google Play Billing
- [ ] Price strategy: Web = $2.99/mo, Play Store = $3.99/mo

---

## Common Path: Feature Development

### Existing Issues:
- [x] PWA ✔
- [ ] Fix voice output six + seven timing with beeps
- [ ] Replace Twitter image/meta tags
- [ ] Generate proper logo/branding

### Core Features:
- [ ] Polyrhythms implementation
- [ ] Tap tempo
- [ ] Visual metronome (flashing/pulsing)
- [ ] Preset management
- [ ] Session recording/playback

### Premium Features:
- [ ] Advanced polyrhythm editor
- [ ] Custom sample upload
- [ ] MIDI sync capability
- [ ] Multi-user sync sessions (WebRTC)
- [ ] Cloud backup
- [ ] Setlist management

---

## Business Model Implementation

### Freemium Tiers:
**Free:**
- Basic metronome (60-200 BPM)
- Standard click sounds (5 options)
- Common time signatures
- Local storage only

**Premium ($2.99-4.99/month):**
- Full BPM range
- All sound packs
- Polyrhythms
- Cloud sync
- Multi-user sessions
- No ads (if implemented)

### Technical Requirements:
- [ ] Backend API (Next.js API routes or separate service)
- [ ] User authentication
- [ ] License validation system
- [ ] Payment webhook handlers
- [ ] Feature flag system

---

## Long-term Roadmap

### Phase 3: Multi-user Sync
- [ ] WebRTC implementation
- [ ] Clock synchronization algorithm
- [ ] Session management
- [ ] Latency compensation

### Phase 4: Ecosystem
- [ ] Desktop app (Electron/Tauri)
- [ ] Apple Watch companion
- [ ] MIDI hardware integration
- [ ] DAW plugin version

---

## Testing Checklist

### Device Testing Matrix:
- [ ] Samsung Galaxy (One UI)
- [ ] Pixel (Stock Android)
- [ ] OnePlus/Xiaomi (Aggressive battery optimization)
- [ ] Old Android (API 21+)
- [ ] Chrome/Firefox/Samsung Internet
- [ ] PWA vs in-browser

### Critical Metrics:
- Wake lock reliability rate
- Audio latency measurements
- Battery drain over 1 hour
- Time to audio suspension
- Background audio capability

---

## ⚡ NEXT IMMEDIATE STEPS:
1. **TODAY**: Implement wake lock test harness
2. **THIS WEEK**: Complete Phase 0 testing
3. **DECISION**: Choose Path A or B based on results
4. **SPRINT 1**: Fix existing bugs + core reliability
5. **SPRINT 2**: Payment integration + premium features

Remember: The wake lock reliability testing will determine EVERYTHING. Don't skip it!

## 🎯 Refactor & Polyrhythm Roadmap (2025-06-10)

### Context
The metronome logic now sits in one 2 100-line component (`ClickTrackGenerator.tsx`). Adding polyrhythms on top of this without untangling concerns first will hurt maintainability and timing accuracy.

### Step-wise Plan
1. **Step 0 – Extract `useAudioEngine` hook**  ✅ _done 2025-06-10_
   ‑ Owns `AudioContext`, wake-lock audio source, sample buffering, and low-level `playTone` / `playBuffer` helpers.
2. **Step 1 – Extract `useMetronome` hook**  ✅ _done 2025-06-10_
   ‑ Keeps simple time-sig / subdivision scheduling (no polyrhythms yet).
3. **Step 2 – Component Split**  ✅ _done 2025-06-10_
   ‑ ✅ `VisualBeatIndicator` extracted.
   ‑ ✅ `PlaybackControls` extracted.
   ‑ ✅ `TransportControls` extracted.
   ‑ ✅ `RhythmControls` extracted.
   ‑ ✅ `PlaylistPanel` extracted.
4. **Step 3 – Add polyrhythm support (3:2, 4:3, 5:4)**
   ‑ Data model: `{top, bottom, anchor}`.
   ‑ Two `Pulse` objects scheduled in `useMetronome`.
   ‑ UI: ratio selector, anchor swap, mute toggles, pitch/pan per pulse.
5. **Step 4 – QA & UI polish**
   ‑ Mobile + desktop latency checks, default pitch/pan tuning.
6. **Step 5 – Ship**

### Key UX Decisions
- Anchor pulse BPM drives tempo slider.
- Different pitch _and_ pan used to distinguish pulses.
- Concentric LED rings visualise the two rhythms.
