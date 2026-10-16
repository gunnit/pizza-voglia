# pizza-voglia.it

Website for **Pizza Voglia** — Via Valpantena 46, Quinto di Valpantena (VR).

## Status
Live site: option C "Valpantena" (sunlit editorial parallax), chosen by Denis on 2026-10-16.

| Path | What |
|---|---|
| `index.html`, `assets/css/style.css`, `assets/js/main.js` | the site |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html` | crawl/AI files and the not-found page |
| `options/` | archived design prototypes A and B plus the proposal page (kept in the repo, not deployed) |

Deploy: every push to `main` publishes to GitHub Pages (`.github/workflows/deploy.yml`).

Verified business facts and content rules: [`docs/brief-options.md`](docs/brief-options.md).

## Run locally
```bash
python3 -m http.server 5173
```
Then open http://localhost:5173/ (prototypes: http://localhost:5173/options/)

## Tests
With the local server running:
```bash
npm install
npm test
```
`tests/smoke.mjs` loads the site and the archived prototypes in headless Chrome at 360/390/768/1024/1280/1440px plus reduced motion and fails on
JS errors, failed requests, horizontal overflow, sideways-scrolled containers, broken images/anchors, invalid JSON-LD.
`tests/interactions.mjs` checks the mobile menu (open, anchor navigation, Escape) and the live open/closed status.

## Assets
`assets/img/` — AI-generated food imagery (Higgsfield, GPT Image 2.5), transparent WebP.
