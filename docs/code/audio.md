# audio.js

All sound is synthesized with the Web Audio API; there are no audio files. Also wraps vibration.

## Exports

| Export | What it does |
|---|---|
| `unlockAudio()` | Creates the audio context on the first call and resumes it if suspended. Browsers only allow audio after a user gesture, so the scene calls this on every pointer-down. |
| `setMuted(bool)` | Mutes or unmutes everything (sounds and vibration). |
| `sfx` | The sound effects, below. |
| `buzz(ms)` | Vibrates the phone for `ms` if supported and not muted. |

## How a sound is made

`tone(freq, dur, { type, vol, to, delay })` plays one oscillator:
- waveform `type`: sine, triangle, square or sawtooth
- optional pitch slide to `to`
- a fast attack and an exponential fade to silence over `dur` seconds
- an optional `delay`

All tones go through one master gain (0.35). Sounds made of several notes (`best`, `door`, `heart`…) are a few tones with increasing delays. Nothing plays before `unlockAudio()` has run or while muted.

## Sounds

| Name | When |
|---|---|
| `launch(power)` | A jump; pitch rises with power. Also when a funnel fires you out. |
| `land(strength)` | Landing; louder for harder landings. |
| `wall` | Bouncing off a side wall. |
| `empty` | Trying to jump with no jumps left. |
| `bounce` | Bouncy platform. |
| `crumble` | A platform breaks under you. |
| `hit` | Losing a heart. |
| `die` | Losing the last heart. |
| `respawn` | Reappearing at 0 m. |
| `heart` / `heartGone` | Picking up a heart / a heart running out. |
| `funnel` | Entering a funnel. |
| `portal` | Entering a blue portal. |
| `star` | Picking up a star. |
| `best` | NEW BEST. |
| `door` | Opening a door. |
| `click` | Menu buttons. |

To add one, add a line to `sfx` using `tone()` and call it from the scene.
