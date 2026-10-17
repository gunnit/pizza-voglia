# pizza-voglia.it

Website for **Pizza Voglia** — Via Valpantena 46, Quinto di Valpantena (VR).

## Status
Live site: option C "Valpantena" (sunlit editorial parallax), chosen by Denis on 2026-10-16.

| Path | What |
|---|---|
| `index.html`, `assets/css/style.css`, `assets/js/main.js` | the site |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html`, `privacy.html` | crawl/AI files, not-found page, privacy notice |
| `assets/img/ig/` | Denis's real photos from Instagram (see `docs/brief-options.md` for sources) |
| `assets/fonts/`, `assets/vendor/` | self-hosted fonts and GSAP/Lenis: the page makes no third-party requests (the map loads on click) |
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

## Content-Security-Policy
`index.html` sets a CSP in a `<meta>` tag that allows the one inline `<script>` in `<head>` by its sha256 hash. If you edit that script, recompute the hash:

```bash
python3 -c "import re,hashlib,base64;s=open('index.html').read();print(base64.b64encode(hashlib.sha256(re.search(r'<script>(.*?)</script>',s,re.S).group(1).encode()).digest()).decode())"
```
