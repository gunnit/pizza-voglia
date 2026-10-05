// Smoke tests for the design-option prototypes, using the system Chrome in headless mode.
// Usage: node tests/smoke.mjs [a-forno b-arcade c-valpantena] [--shots] [--debug-shots=DIR]
//   --shots             write gallery screenshots to options/shots/<key>-{desktop,mobile}.jpg
//   --debug-shots=DIR   write top/middle/bottom screenshots per viewport for visual review
// Requires the static server: python3 -m http.server 5173 --bind 127.0.0.1
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const wantShots = args.includes('--shots');
const debugDir = (args.find((a) => a.startsWith('--debug-shots=')) || '').split('=')[1];
const pages = args.filter((a) => !a.startsWith('--'));
const OPTIONS = pages.length ? pages : ['a-forno', 'b-arcade', 'c-valpantena'];

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: 'laptop-1024', width: 1024, height: 768, deviceScaleFactor: 1 },
  { name: 'laptop-1280', width: 1280, height: 800, deviceScaleFactor: 1 },
  { name: 'desktop-1440', width: 1440, height: 900, deviceScaleFactor: 1 },
];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollThrough(page) {
  const { total, vh } = await page.evaluate(() => ({ total: document.documentElement.scrollHeight, vh: innerHeight }));
  for (let y = 0; y < total; y += Math.round(vh * 0.7)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(140);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(600);
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const inFixed = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
    const offenders = [];
    if (sw > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > vw + 1 && !inFixed(el)) {
          const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
          offenders.push({ d: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} (right=${Math.round(r.right)})`, r: r.right });
        }
      }
      offenders.sort((a, b) => b.r - a.r);
    }
    return { vw, sw, overflow: sw > vw + 1, offenders: offenders.slice(0, 6).map((o) => o.d) };
  });
}

async function staticChecks(page) {
  return page.evaluate(() => {
    const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src'));
    const badAnchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1))));
    let jsonld = 'missing';
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) { try { JSON.parse(ld.textContent); jsonld = 'ok'; } catch (e) { jsonld = 'INVALID: ' + e.message; } }
    const sideScrolled = [...document.querySelectorAll('body *')].filter((e) => e.scrollLeft > 0 && getComputedStyle(e).overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1).map((e) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''} scrollLeft=${e.scrollLeft}`);
    const tel = document.querySelectorAll('a[href^="tel:+393662205988"]').length;
    const h1 = document.querySelectorAll('h1').length;
    const title = document.title;
    const desc = document.querySelector('meta[name="description"]')?.content || '';
    const imgsNoAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length;
    return { broken, badAnchors: [...new Set(badAnchors)], jsonld, tel, h1, title, descLen: desc.length, imgsNoAlt, sideScrolled };
  });
}

async function gameTest(page) {
  // Option B only: start the game and play blind for a few seconds.
  const canvas = await page.$('canvas');
  if (!canvas) return { ok: false, note: 'no canvas found' };
  await canvas.scrollIntoView();
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Enter');
  await sleep(400);
  await page.keyboard.press('Space');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    await sleep(700);
    await page.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight');
  }
  await sleep(1500);
  const shot = debugDir ? join(debugDir, 'b-game-play.jpg') : null;
  if (shot) await canvas.screenshot({ path: shot, type: 'jpeg', quality: 80 });
  return { ok: true, box: { w: Math.round(box.width), h: Math.round(box.height) } };
}

async function run() {
  const profile = mkdtempSync(join(tmpdir(), 'pv-smoke-'));
  if (debugDir) mkdirSync(debugDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profile,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--hide-scrollbars'],
  });
  let failures = 0;
  const lines = [];
  try {
    for (const opt of OPTIONS) {
      const key = opt.split('-')[0];
      const url = `${BASE}/options/${opt}/`;
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
        page.on('requestfailed', (r) => { const u = r.url(); if (!u.includes('google.com/maps') && !u.includes('gstatic')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`); });
        page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
        if (vp.isMobile) await page.setUserAgent(IPHONE_UA);
        await page.setViewport(vp);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(1800);
        if (debugDir) await page.screenshot({ path: join(debugDir, `${key}-${vp.name}-0top.jpg`), type: 'jpeg', quality: 70 });
        if (wantShots && (vp.name === 'desktop-1440' || vp.name === 'mobile-390')) {
          const kind = vp.name === 'desktop-1440' ? 'desktop' : 'mobile';
          await page.screenshot({ path: join(ROOT, 'options', 'shots', `${key}-${kind}.jpg`), type: 'jpeg', quality: 82 });
        }
        await scrollThrough(page);
        const ov = await overflowReport(page);
        if (debugDir) {
          const total = await page.evaluate(() => document.documentElement.scrollHeight);
          for (const [i, f] of [[1, 0.2], [2, 0.4], [3, 0.6], [4, 0.8]]) {
            await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * f));
            await sleep(900);
            await page.screenshot({ path: join(debugDir, `${key}-${vp.name}-${i}.jpg`), type: 'jpeg', quality: 70 });
          }
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await sleep(900);
          await page.screenshot({ path: join(debugDir, `${key}-${vp.name}-5bottom.jpg`), type: 'jpeg', quality: 70 });
        }
        const st = await staticChecks(page);
        let game = null;
        if (opt.startsWith('b-') && !vp.isMobile) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(500);
          game = await gameTest(page);
          const after = await staticChecks(page);
          if (after.sideScrolled.length) errors.push(`after game: clipped container scrolled sideways: ${after.sideScrolled.join(', ')}`);
        }
        const problems = [...errors];
        if (ov.overflow) problems.push(`horizontal overflow: scrollWidth ${ov.sw} > ${ov.vw}; ${ov.offenders.join(', ')}`);
        if (st.broken.length) problems.push(`broken images: ${st.broken.join(', ')}`);
        if (st.badAnchors.length) problems.push(`anchors without target: ${st.badAnchors.join(', ')}`);
        if (st.jsonld !== 'ok') problems.push(`JSON-LD ${st.jsonld}`);
        if (!st.tel) problems.push('no tel:+393662205988 link');
        if (st.h1 !== 1) problems.push(`h1 count ${st.h1}`);
        if (st.imgsNoAlt) problems.push(`${st.imgsNoAlt} <img> without alt`);
        if (st.sideScrolled.length) problems.push(`clipped container scrolled sideways: ${st.sideScrolled.join(', ')}`);
        if (game && !game.ok) problems.push(`game: ${game.note}`);
        failures += problems.length ? 1 : 0;
        lines.push(`${problems.length ? 'FAIL' : 'ok  '} ${opt.padEnd(13)} ${vp.name.padEnd(13)} ${problems.length ? '\n       - ' + [...new Set(problems)].join('\n       - ') : ''}`);
        await page.close();
      }
      // Reduced-motion pass: page must still show its hero copy.
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(1200);
      const vis = await page.evaluate(() => {
        const h = document.querySelector('h1'); if (!h) return 0;
        const effOpacity = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
        return [h, ...h.querySelectorAll('*')].some((el) => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.bottom > 0 && r.top < innerHeight && effOpacity(el) > 0.5 && getComputedStyle(el).visibility !== 'hidden'; }) ? 1 : 0;
      });
      const rmProblems = [...errs, ...(vis ? [] : ['h1 not visible under reduced motion'])];
      failures += rmProblems.length ? 1 : 0;
      lines.push(`${rmProblems.length ? 'FAIL' : 'ok  '} ${opt.padEnd(13)} reduced-motion${rmProblems.length ? '\n       - ' + rmProblems.join('\n       - ') : ''}`);
      if (debugDir) await page.screenshot({ path: join(debugDir, `${key}-reduced-motion.jpg`), type: 'jpeg', quality: 70 });
      await page.close();
    }
  } finally {
    await browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(lines.join('\n'));
  console.log(`\n${failures ? `${failures} check group(s) failed` : 'All smoke checks passed'}`);
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
