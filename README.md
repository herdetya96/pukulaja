# PUKUL AJA! 🥊

A 3D face-punching stress arcade. Upload a photo of someone who annoys you —
it gets wrapped onto a wobbly bop-bag dummy's head — then beat the daylights
out of it with boxing gloves. Score points, chain combos, ring the bell.

## Run it

Any static server works:

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

(Three.js is vendored in `lib/`, the only network dependency is Google Fonts —
the game still works offline with fallback fonts.)

## Controls

### Desktop (keyboard)
| Key | Punch | Points |
|---|---|---|
| `J` / `←` | Left jab | +10 |
| `K` / `→` | Right cross | +15 |
| `H` | Left hook | +20 |
| `L` | Right hook | +20 |
| `U` / `↑` | Uppercut | +30 |
| `Space` | Jab flurry (alternating) | |
| Click | Jab / cross | |
| `C` | Change the face | |

### Mobile / touch
- **D-pad (bottom-left):** ▲ cross · ◀ ▶ hooks · ▼ uppercut · center = jab.
- **Action buttons (bottom-right):** big JAB + UPPER.
- Tap the dummy for quick jabs.

## Secret moves 💥
Chain these punches quickly (within the combo window) for a special:

| Sequence | Move | Bonus |
|---|---|---|
| HOOK · HOOK · JAB | 💥 Dynamite (explosion + shockwave) | +200 |
| JAB · CROSS · UPPER | 🚀 Rocket (launches the dummy) | +250 |
| CROSS · CROSS · HOOK | 🌪 Tornado (spin-out) | +150 |

Special bonuses are multiplied by your current combo multiplier.

## Scoring
- Land hits within 1.4s of each other to build a **combo** — every 5 hits raises the multiplier (up to ×5).
- Every 10th combo hit is a **CRITICAL** (double points).
- Drain the HP bar for a **K.O.** — bell rings, bonus points, next round has a tougher dummy.
- Best score is saved locally.

## Privacy
Uploaded photos never leave the browser — they're drawn onto a canvas texture
in memory and nothing is stored or transmitted.
