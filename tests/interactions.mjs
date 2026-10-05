// Interaction tests: mobile menu open/close + anchor navigation, on each option prototype.
// Usage: node tests/interactions.mjs [a-forno b-arcade c-valpantena]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pages = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OPTIONS = pages.length ? pages : ['a-forno', 'b-arcade', 'c-valpantena'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'pv-int-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
let failed = 0;
try {
  for (const opt of OPTIONS) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/options/${opt}/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    const res = [];
    // 1. hamburger
    const toggle = await page.$('header button[aria-expanded], button[aria-controls][aria-expanded]');
    if (!toggle) { res.push('FAIL no menu toggle with aria-expanded'); }
    else {
      await toggle.tap();
      // poll: menus animate in (headless software-GL makes this slower than real devices)
      let open;
      for (let t = 0; t < 3000; t += 150) {
        await sleep(150);
        open = await page.evaluate(() => {
        const t = document.querySelector('header button[aria-expanded], button[aria-controls][aria-expanded]');
        const panel = t.getAttribute('aria-controls') ? document.getElementById(t.getAttribute('aria-controls')) : null;
        const scope = panel || document;
        const links = [...scope.querySelectorAll('a[href^="#"]')].filter((a) => { const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5; });
        return { expanded: t.getAttribute('aria-expanded'), visibleLinks: links.map((a) => a.getAttribute('href')) };
        });
        if (open.expanded === 'true' && open.visibleLinks.length >= 3) break;
      }
      res.push(`${open.expanded === 'true' && open.visibleLinks.length >= 3 ? 'ok  ' : 'FAIL'} menu opens (aria-expanded=${open.expanded}, visible links: ${open.visibleLinks.join(' ')})`);
      // 2. click a link inside the menu → menu closes and target in view
      const target = open.visibleLinks.find((h) => /dove|contatti|visita|mappa/i.test(h)) || open.visibleLinks[open.visibleLinks.length - 1];
      if (target) {
        await page.evaluate((h) => { const t = document.querySelector('header button[aria-expanded], button[aria-controls][aria-expanded]'); const panel = t.getAttribute('aria-controls') ? document.getElementById(t.getAttribute('aria-controls')) : document; [...(panel || document).querySelectorAll(`a[href="${h}"]`)].find((a) => a.getBoundingClientRect().height > 0)?.click(); }, target);
        await sleep(2500);
        const after = await page.evaluate((h) => { const t = document.querySelector('header button[aria-expanded], button[aria-controls][aria-expanded]'); const el = document.getElementById(decodeURIComponent(h.slice(1))); const r = el?.getBoundingClientRect(); return { expanded: t.getAttribute('aria-expanded'), top: r ? Math.round(r.top) : null, y: Math.round(scrollY) }; }, target);
        res.push(`${after.expanded !== 'true' && after.top !== null && after.top < 300 && after.top > -400 ? 'ok  ' : 'FAIL'} link ${target} closes menu and scrolls (aria-expanded=${after.expanded}, target top=${after.top}, scrollY=${after.y})`);
      }
      // 3. Escape closes (fresh load: smooth-scroll libraries fight instant programmatic scrolls)
      await page.goto(`${BASE}/options/${opt}/`, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(1200);
      await (await page.$('header button[aria-expanded], button[aria-controls][aria-expanded]')).tap();
      await sleep(600);
      await page.keyboard.press('Escape');
      await sleep(600);
      const esc = await page.evaluate(() => document.querySelector('header button[aria-expanded], button[aria-controls][aria-expanded]').getAttribute('aria-expanded'));
      res.push(`${esc !== 'true' ? 'ok  ' : 'FAIL'} Escape closes menu (aria-expanded=${esc})`);
    }
    // 4. open/closed status text present
    const status = await page.evaluate(() => { const m = document.body.textContent.replace(/\s+/g, ' ').match(/(Aperto ora|Chiuso[^\n]{0,40}|APERTO[^\n]{0,30}|CHIUSO[^\n]{0,40})/i); return m ? m[0] : null; });
    res.push(`${status ? 'ok  ' : 'FAIL'} open/closed status: ${status}`);
    if (errors.length) res.push(`FAIL page errors: ${errors.join(' | ')}`);
    failed += res.filter((l) => l.startsWith('FAIL')).length;
    console.log(`== ${opt}\n  ${res.join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} interaction check(s) failed` : '\nAll interaction checks passed');
process.exit(failed ? 1 : 0);
