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

---

# Slash Photo 📸 (`photo/`)

An iOS-style photo editor that lives in the `photo/` folder. Pick a photo, choose
one of 100 `/slash` effects, then fine-tune every setting with sliders. Editing
runs **on the device** (WebGL) — no account, no API key, nothing uploaded.

## Run it

It is a static web app with no build step. Serve the repo and open `/photo/`:

```bash
python3 -m http.server 4173
# open http://localhost:4173/photo/
```

On an iPhone, open the hosted URL in Safari → Share → **Add to Home Screen**.
It then launches full-screen like a native app.

## How it works

- **76 effects are on-device "recipes"** — plain sets of editor parameters
  (exposure, colour, grain, lens distortion, light leaks, frames, …). Selecting
  one loads its values into the sliders; thumbnails are rendered from your photo.
- **24 effects need an AI model** because they change what is *in* the photo
  (new camera angle, cloned subject, new background). They are tagged "AI", are
  optional, and can be hidden in Setelan. They need your own API key
  (Google Gemini, OpenAI, or OpenRouter-compatible).

## What you can edit

| Where | What |
|---|---|
| Studio → **Atur** | ~75 parameters in 7 groups: Cahaya, Warna, Detail, Lensa, Sinar, Tekstur, Bingkai. Plus overall effect strength. Tap a number to reset it. |
| Studio → Atur → Kekuatan | Save the current sliders back into the effect, or as a new effect. |
| **Efek** tab | Each effect's command, name, category, engine (on-device or AI), its settings as JSON, and its AI prompt. Add, duplicate, hide, favourite, reorder, delete, restore. |
| Efek → Kelola kategori | Category emoji, name, colour, order. |
| **Setelan** | Working/export resolution, JPEG quality, gallery, app name, theme, accent colour, AI provider/key/model/base URL/prompt wrapper. |
| Setelan → Cadangan | Export / import the whole configuration as JSON. |

## Files

- `photo/engine.js` — the photo engine: parameter schema, shaders, frames.
- `photo/presets.js` — default categories, effects and their recipes.
- `photo/app.js` — UI and state. `photo/styles.css` — iOS-style look.

Settings live in `localStorage`; saved results in IndexedDB (the **Galeri** tab).
