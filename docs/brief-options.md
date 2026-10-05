# Pizza Voglia (Quinto di Valpantena) — design options brief

Goal: a website for the real pizzeria **Pizza Voglia in Quinto di Valpantena (Verona)** that looks
dramatically more premium and memorable than any local competitor. We are building **3 distinct
design-direction prototypes** so the client can pick one. Each must look like a top-tier agency
produced it (Awwwards-level), be fully responsive, and use only the verified facts below.

Language of all site copy: **Italian**. `lang="it"`.

## Verified business facts (use ONLY these — never invent prices, years, awards, delivery, etc.)

- Name shown to customers: **Pizza Voglia** (Google listing spells it "Pizzavoglia").
- Pizzaiolo / owner: **Denis** (Denis Vecchi). Denis is "nel mondo della pizza dal 2002" (since 2002).
- New dough at **75% di idratazione** (75% hydration). Location recently renovated ("location restaurata").
- **Denis's pizza is SQUARE/RECTANGULAR** — pizza **al taglio in teglia** (rectangular trays in a glass vitrine, sold by weight,
  cut into rectangles) and **alla pala**. NO round/Neapolitan pizza anywhere (no round pizza images, no "tonda" in copy).
  Real shop: long glass vitrine with black steel trays, wooden counter, Edison bulbs, cream/terracotta checkered floor.
- Formats: **al taglio** (a peso, sempre pronta in vetrina) · **alla pala** · **teglie/vassoi per feste e buffet** (su prenotazione).
  Wide choice of **farine e impasti**.
  Also calzoni and focacce. **Aperitivi**. **Buffet / catering** for parties and events (everything ready on request).
- Seen on their Instagram: special pizza with **Broccoli di Novaglie, taralli, Monte Veronese e mozzarella**.
- Partner of **Too Good To Go** (anti-waste surprise bags) — optional small mention.
- Address: **Via Valpantena 46, 37142 Quinto di Valpantena (VR)** — Verona.
- Phone: **366 220 5988** → `tel:+393662205988`.
- Hours (Google):
  - Lunedì–Venerdì: 11:00–13:30 · 17:30–20:30
  - Sabato: 17:00–20:30
  - Domenica: 17:00–20:30
- Google rating: **4,8 ★ su 81 recensioni**. Distribution: 5★ 70 · 4★ 7 · 3★ 2 · 2★ 0 · 1★ 2.
- Topics Google extracts from the reviews (mentions): ingredienti 7 · impasto 7 · scelta 5 · aperitivo 4 · prodotti 3 · vegetariani 2.
- Google Maps (read reviews): `https://maps.google.com/?cid=11664370951363129552`
- Map embed (no API key): `https://www.google.com/maps?q=Pizzavoglia,+Via+Valpantena+46,+37142+Verona&output=embed`
- Instagram: `https://www.instagram.com/pizzavoglia_denis/` (@pizzavoglia_denis)
- Facebook: `https://www.facebook.com/Pizzvoglia/`
- Logo (for reference only, we don't have the file): round cream/yellow badge, "PIZZA / VOGLIA" in a box, three dots red-green-brown. Build a typographic wordmark instead.

### What reviewers say (themes — PARAPHRASE ONLY)
Never present these as quotes, never put quotation marks around them, never attribute them to a named person,
never invent reviewer names. Present them as "Cosa emerge dalle recensioni" / themes.
- Pizza eccezionale, croccante e leggerissima — per niente unta né pesante.
- Ingredienti genuini e ricercati, prodotti di qualità.
- Tantissimi gusti, pizze particolari e innovative, cotte al momento.
- Personale sorridente, titolare cordiale e professionale.
- Locale accogliente, curato, pulito e rinnovato; tavolini dentro e fuori per mangiare sul posto.
- Perfetto per l'aperitivo; buffet per feste organizzati con tutto pronto.

Always link "Leggi tutte le recensioni su Google" → the Google Maps link above.

## Generic menu (no prices!)
Label it clearly: "Menu indicativo — le pizze cambiano spesso: chiedi in pizzeria le proposte del giorno."
Show no prices (no € figures at all).
- **In vetrina** (al taglio, a peso): Margherita · Rossa all'origano · Patate e rosmarino · Verdure di stagione · Salame piccante
- **I classici** (al taglio): Marinara · Margherita · Diavola · Capricciosa · Quattro formaggi · Prosciutto e funghi · Bufala · Ortolana (vegetariana)
- **La speciale del territorio**: "Valpantena" — broccoli di Novaglie, taralli, Monte Veronese, mozzarella
- **Dal forno**: Calzoni · Focacce
- **Aperitivi & buffet**: teglie e vassoi di pizza al taglio per feste, compleanni e ufficio — su prenotazione

## Denis & the territory (from the client side, 2026-10-05)
- Denis loves **rally** and **80s culture**. He — and his customers — are **proud of the region and its products**.
- Verified regional facts you may use (no affiliation claims, no third-party logos):
  - **Valpantena** is the valley that climbs from Verona north to the **Lessinia** plateau; Quinto sits at its mouth (Grezzana further up).
  - **Monte Veronese DOP** (DOP since 1992) — the cheese of Lessinia, also produced in Valpantena. Denis uses it (Instagram special).
  - **Broccolo di Novaglie** — traditional Veneto product (PAT), De.Co. of Verona; Novaglie is a hamlet in the hills of Verona;
    its "Sagra del Broccolo" has run since 1933. Denis uses it (Instagram special).
  - Valpantena roads are **rally territory**: Verona's historic rally (since 1972) has had special stages here, e.g. the
    hairpins of Montecchio above Grezzana. Use as flavour ("Valpantena, terra di rally") — don't name/brand the event.
- Don't claim other specific products are on the menu; "prodotti del territorio" in general is fine.

## Hard rules
- No fake/fabricated reviews, quotes, names, numbers, prices or claims. No delivery claims (we don't know).
- Never mention or allude to any competitor.
- Primary CTA everywhere: **Chiama e ordina** → `tel:+393662205988`. Secondary: menu, directions.
- "Indicazioni" button → `https://www.google.com/maps/dir/?api=1&destination=45.4933179,11.0191`
- Accessibility: semantic landmarks, alt text, focus styles, keyboard operable, WCAG AA contrast,
  `prefers-reduced-motion` turns off heavy motion (3D/parallax become static, page still looks great).
- Performance: cap devicePixelRatio at 2, pause animation loops when off-screen / tab hidden,
  lazy-load images below the fold, `loading="lazy"` on iframes.
- Mobile-first: perfect at 360–430px wide, no horizontal page scroll, touch-friendly (44px targets).
- Each prototype has a small discreet fixed pill linking back to the options gallery: `../index.html` labeled "← Opzioni".
- SEO basics in `<head>`: title, meta description, Open Graph tags, and a JSON-LD `Restaurant` block
  (name, address, geo 45.4933179/11.0191, telephone, openingHoursSpecification, servesCuisine Pizza,
  aggregateRating 4.8/81, url https://pizza-voglia.it, sameAs Instagram + Facebook, hasMap the Google Maps link).

## Tech constraints
- No build step. Each option lives in `options/<id>/` with `index.html`, `style.css`, `main.js` (`<script type="module">`).
- External scripts ONLY from cdn.jsdelivr.net (pin these versions):
  - three: import map → `https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js`,
    addons `https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/`
  - gsap: `https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js` + `.../dist/ScrollTrigger.min.js`
    (GSAP is free incl. plugins; load as classic scripts before main.js, use `window.gsap`)
  - lenis: `https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js` + `.../dist/lenis.css` (`window.Lenis`)
- Fonts: Google Fonts only.
- Site is served from repo root by a static server (`python3 -m http.server 5173`), so use **relative** asset paths
  from `options/<id>/`: `../../assets/img/...`
- Everything must degrade gracefully: if WebGL or a CDN fails, the page still renders (static fallback image).

## Available image assets (AI-generated, transparent backgrounds, WebP)
- **USE THESE for the pizza (square!)**: `assets/img/teglia-top.webp` (1800x1200) / `teglia-top-900.webp` — top-down
  rectangular margherita in teglia; `assets/img/teglia/slice-{0,1}-{0,1,2}.webp` — the same teglia cut into a 3x2 grid
  of square slices (row-col; put them back together edge to edge to rebuild the whole teglia); `assets/img/crumb-side.webp`
  (2048x300, tileable horizontally) — real airy crumb for cut sides in 3D (top = topping edge, bottom = golden base).
  Built by `scripts/make_teglia.py`.
- `slice-1200.webp` is a square al-taglio slice (3/4 view) — accurate, keep using it.
- The round `pizza-top-*.webp` images were removed (wrong product); its source stays in `assets/_src` only as raw material for `make_teglia.py`.
- `assets/img/pizza-top-1600.webp` and `pizza-top-800.webp` — perfect top-down whole margherita (square, transparent, pizza fills the frame edge to edge) — ideal as a texture on a 3D disc or as a rotating hero cutout.
- `assets/img/slice-1200.webp` / `slice-600.webp` — 3/4 view rectangular pizza al taglio slice with broccoli, Monte Veronese shavings, taralli (1200x865).
- `assets/img/ing/*.webp` (≈300–430px, transparent cutouts): `basil-leaf`, `basil-sprig`, `tomato`, `tomato-half`,
  `mozzarella-slice`, `mozzarella-torn`, `salame`, `olive`, `mushroom`, `chili`, `garlic`, `broccoli`.
