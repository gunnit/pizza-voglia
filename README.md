# pizza-voglia.it

Website for **Pizza Voglia** — Via Valpantena 46, Quinto di Valpantena (VR).

## Status
Design phase: three clickable prototypes live in [`options/`](options/):

| Option | Folder | Direction |
|---|---|---|
| A | `options/a-forno/` | Forno — cinematic dark 3D (Three.js) |
| B | `options/b-arcade/` | Sala Giochi — retro arcade with playable mini-game |
| C | `options/c-valpantena/` | Valpantena — sunlit editorial parallax |

Verified business facts and content rules: [`docs/brief-options.md`](docs/brief-options.md).

## Run locally
```bash
python3 -m http.server 5173
```
Then open http://localhost:5173/options/

## Assets
`assets/img/` — AI-generated food imagery (Higgsfield, GPT Image 2.5), transparent WebP.
