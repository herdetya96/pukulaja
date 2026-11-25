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

An iOS-style photo app that lives in the `photo/` folder: pick a photo, choose
one of 100 `/slash` commands (or type your own), and an AI image model applies
the edit. **Everything is configurable in the app** — no code changes needed.

## Run it

It is a static web app with no build step. Serve the repo and open `/photo/`:

```bash
python3 -m http.server 4173
# open http://localhost:4173/photo/
```

On an iPhone, open the hosted URL in Safari → Share → **Add to Home Screen**.
It then launches full-screen like a native app.

## What you can edit

| Where | What |
|---|---|
| **Efek** tab | Every effect's command, name, prompt, category and output ratio. Add, duplicate, hide, favourite, reorder, delete, or restore a built-in. |
| **Efek → Kelola kategori** | Category emoji, name, colour and order. Add or delete categories. |
| **Setelan → Mesin AI** | Provider (Google Gemini, OpenAI, OpenRouter / compatible), API key, model, base URL. "Tes koneksi & pilih model" lists the image models your key can use. |
| **Setelan → Prompt** | Text added before/after every prompt, default output ratio, how many effects can be stacked. |
| **Setelan → Foto** | Upload size, JPEG quality, auto-save to gallery, gallery limit. |
| **Setelan → Tampilan** | App name, accent colour, light/dark theme, grid columns. |
| **Setelan → Cadangan** | Export / import the whole configuration as JSON. |
| Studio → `{ }` | The final prompt for a single run, before it is sent. |

## Notes

- You need your own API key from the provider you choose. It is stored only in
  this browser (`localStorage`) and sent straight to that provider.
- Photos are resized on the device and sent only to the provider you configured.
  Results are kept in the browser's IndexedDB (the **Galeri** tab).
- Default data lives in `photo/presets.js`; app logic in `photo/app.js`.
