/* ==========================================================================
   Pizza Voglia — Option C “VALPANTENA” — main.js (ES module)
   Progressive enhancement: the page is complete and composed without this
   file. With GSAP + ScrollTrigger + Lenis it becomes the layered experience;
   with prefers-reduced-motion it stays static.
   ========================================================================== */

const doc = document;
const root = doc.documentElement;
const $ = (sel, ctx = doc) => ctx.querySelector(sel);
const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const media = (q) => window.matchMedia(q);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const LenisCtor = window.Lenis;

const REDUCED = media('(prefers-reduced-motion: reduce)').matches;
const HAS_GSAP = Boolean(gsap && ScrollTrigger);
const MOTION = HAS_GSAP && !REDUCED;
const FINE = media('(hover: hover) and (pointer: fine)').matches;

if (window.__pvFailsafe) clearTimeout(window.__pvFailsafe);

const state = { lenis: null, heroActive: true };

function safe(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[Pizza Voglia] ${label}`, err);
    return undefined;
  }
}

/* --------------------------------------------------------------------------
   Opening hours — computed in Europe/Rome time
   -------------------------------------------------------------------------- */
const H = (h, m = 0) => h * 60 + m;
const WEEKDAY = [[H(11), H(13, 30)], [H(17, 30), H(20, 30)]];
const WEEKEND = [[H(17), H(20, 30)]];
const HOURS = { 0: WEEKEND, 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: WEEKEND };
const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

function romeNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parseInt(get('hour'), 10) % 24;
  return { day: days[get('weekday')], mins: hour * 60 + parseInt(get('minute'), 10) };
}

function computeStatus() {
  const { day, mins } = romeNow();
  const today = HOURS[day] || [];
  for (const [open, close] of today) {
    if (mins >= open && mins < close) {
      const text = close - mins <= 30 ? `Aperto ora · chiude alle ${fmt(close)}` : `Aperto ora · fino alle ${fmt(close)}`;
      return { open: true, text, day };
    }
  }
  const later = today.find(([open]) => open > mins);
  if (later) return { open: false, text: `Chiuso ora · apre alle ${fmt(later[0])}`, day };
  const tomorrow = HOURS[(day + 1) % 7];
  return { open: false, text: `Chiuso ora · apre domani alle ${fmt(tomorrow[0][0])}`, day };
}

function initStatus() {
  const render = () => {
    const s = computeStatus();
    $$('[data-open-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
      const text = $('.status__text', el);
      if (text) text.textContent = s.text;
    });
    $$('.hours tr[data-day]').forEach((tr) => {
      const isToday = Number(tr.dataset.day) === s.day;
      tr.classList.toggle('is-today', isToday);
      if (isToday) tr.setAttribute('aria-current', 'date');
      else tr.removeAttribute('aria-current');
    });
  };
  render();
  setInterval(render, 60 * 1000);
}

function initYear() {
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
}

/* --------------------------------------------------------------------------
   Scroll UI: progress hairline, nav background, floating call button
   -------------------------------------------------------------------------- */
function initScrollUI() {
  const nav = $('.nav');
  const bar = $('.progress__bar');
  const fab = $('.call-fab');
  let queued = false;

  const update = () => {
    queued = false;
    const y = window.scrollY;
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    if (bar) bar.style.transform = `scaleX(${clamp(y / max, 0, 1).toFixed(4)})`;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (fab) fab.classList.toggle('is-visible', y > window.innerHeight * 0.55);
  };
  const request = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

/* --------------------------------------------------------------------------
   Mobile menu (full-screen editorial overlay)
   -------------------------------------------------------------------------- */
function initMenu() {
  const btn = $('.nav__toggle');
  const overlay = $('#menu-overlay');
  if (!btn || !overlay) return { close() {}, isOpen: () => false };

  const label = $('.nav__toggle-label', btn);
  const background = [$('#contenuto'), $('.footer'), $('.opts-pill'), $('.call-fab'), $('.skip-link'), $('.brand')].filter(Boolean);
  let open = false;
  let hideTimer = 0;

  const focusables = () => [btn, ...$$('a[href], button:not([disabled])', overlay)];

  const setOpen = (value, { restoreFocus = true } = {}) => {
    if (value === open) return;
    open = value;
    clearTimeout(hideTimer);
    btn.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Chiudi' : 'Menu';
    root.classList.toggle('menu-open', open);
    background.forEach((el) => { el.inert = open; });

    if (open) {
      overlay.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
      if (state.lenis) state.lenis.stop();
      doc.body.style.overflow = 'hidden';
      setTimeout(() => { const first = $('a', overlay); if (first) first.focus({ preventScroll: true }); }, 80);
    } else {
      overlay.classList.remove('is-open');
      if (state.lenis) state.lenis.start();
      doc.body.style.overflow = '';
      hideTimer = setTimeout(() => { overlay.hidden = true; }, REDUCED ? 0 : 560);
      if (restoreFocus) btn.focus({ preventScroll: true });
    }
  };

  btn.addEventListener('click', () => setOpen(!open));

  doc.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  media('(min-width: 960px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false, { restoreFocus: false });
  });

  return { close: () => setOpen(false, { restoreFocus: false }), isOpen: () => open };
}

/* --------------------------------------------------------------------------
   In-page anchors (smooth with Lenis, accessible focus handling)
   -------------------------------------------------------------------------- */
const expoOut = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function initAnchors(menu) {
  doc.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = doc.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;

    e.preventDefault();
    if (menu.isOpen()) menu.close();

    const isTop = hash === '#top';
    if (state.lenis) {
      state.lenis.scrollTo(isTop ? 0 : target, { duration: 1.6, easing: expoOut, force: true });
    } else {
      const behavior = REDUCED ? 'auto' : 'smooth';
      if (isTop) window.scrollTo({ top: 0, behavior });
      else target.scrollIntoView({ behavior, block: 'start' });
    }

    if (history.replaceState) history.replaceState(null, '', isTop ? location.pathname + location.search : hash);

    const focusEl = isTop ? $('#contenuto') : target;
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(focusEl.tagName)) {
        focusEl.setAttribute('tabindex', '-1');
      }
      focusEl.focus({ preventScroll: true });
    }
  });
}

/* --------------------------------------------------------------------------
   Active states: top nav + menu index
   -------------------------------------------------------------------------- */
function initActiveStates() {
  if (!('IntersectionObserver' in window)) return;

  const navLinks = $$('[data-nav]');
  const sections = ['storia', 'territorio', 'menu', 'recensioni', 'buffet', 'dove'].map((id) => doc.getElementById(id)).filter(Boolean);
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach((a) => {
        if (a.dataset.nav === id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-48% 0px -48% 0px' });
  sections.forEach((s) => navIO.observe(s));

  const hero = $('.hero');
  if (hero) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) navLinks.forEach((a) => a.removeAttribute('aria-current'));
    }, { threshold: [0, 0.5, 1] }).observe(hero);
  }

  const catLinks = $$('[data-cat]');
  const list = $('.menu__index ol');
  const cats = catLinks.map((a) => doc.getElementById(a.dataset.cat)).filter(Boolean);
  const catIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      catLinks.forEach((a) => {
        const active = a.dataset.cat === id;
        a.classList.toggle('is-active', active);
        if (active && list && list.scrollWidth > list.clientWidth + 4) {
          const left = a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2;
          list.scrollTo({ left, behavior: REDUCED ? 'auto' : 'smooth' });
        }
      });
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  cats.forEach((c) => catIO.observe(c));
}

/* --------------------------------------------------------------------------
   Flour dust — canvas particles that glint only inside the light beam
   (beam geometry mirrors .hero__beam in style.css: centre 42%/34%, 26°, 40vmin)
   -------------------------------------------------------------------------- */
class Dust {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.burst = 0;
    this.burstTarget = 0;
    this.light = Dust.sprite(['rgba(255,253,247,1)', 'rgba(255,247,230,.55)', 'rgba(255,247,230,0)']);
    this.dark = Dust.sprite(['rgba(178,140,96,.9)', 'rgba(178,140,96,.35)', 'rgba(178,140,96,0)']);
    this.loop = this.loop.bind(this);
    this.resize();
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  static sprite(stops) {
    const s = doc.createElement('canvas');
    s.width = s.height = 32;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.38, stops[1]);
    grad.addColorStop(1, stops[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return s;
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    if (w === this.w && h === this.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const angle = (26 * Math.PI) / 180;
    this.bx = w * 0.42;
    this.by = h * 0.34;
    this.ux = Math.cos(angle);
    this.uy = Math.sin(angle);
    this.half = Math.min(w, h) * 0.2;
    this.diag = Math.hypot(w, h);
    const count = Math.round(clamp((w * h) / 8500, 46, 170));
    this.parts = Array.from({ length: count }, () => this.spawn(true));
    if (!this.running) this.draw(0, performance.now() / 1000);
  }

  spawn(initial) {
    let x;
    let y;
    if (Math.random() < 0.78) {
      const t = (Math.random() * 2 - 1) * this.diag * 0.62;
      const o = (Math.random() * 2 - 1) * this.half * 1.15;
      x = this.bx + this.ux * t - this.uy * o;
      y = this.by + this.uy * t + this.ux * o;
    } else {
      x = Math.random() * this.w;
      y = Math.random() * this.h;
    }
    const z = Math.random();
    return {
      x,
      y,
      z,
      r: 0.7 + z * z * 2.6,
      vx: (Math.random() - 0.4) * 7,
      vy: -(2 + Math.random() * 7),
      ph: Math.random() * Math.PI * 2,
      tw: 0.5 + Math.random() * 1.7,
      dark: Math.random() < 0.3,
      life: initial ? 1 : 0,
    };
  }

  beam(x, y) {
    const dx = x - this.bx;
    const dy = y - this.by;
    const d = Math.abs(-this.uy * dx + this.ux * dy);
    const t = 1 - clamp(d / this.half, 0, 1);
    return t * t * (3 - 2 * t);
  }

  kick(velocity) {
    this.burstTarget = Math.max(this.burstTarget, clamp(velocity / 2600, 0, 1.4));
  }

  draw(dt, time) {
    const { ctx, w, h } = this;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    this.burst += (this.burstTarget - this.burst) * Math.min(1, dt * 6);
    this.burstTarget *= Math.pow(0.08, dt);
    const cx = w * 0.52;
    const cy = h * 0.55;

    for (let i = 0; i < this.parts.length; i += 1) {
      const p = this.parts[i];
      const speed = 0.35 + p.z * 0.9;
      p.x += (p.vx + Math.sin(time * 0.45 + p.ph) * 5) * dt * speed;
      p.y += (p.vy + Math.cos(time * 0.38 + p.ph) * 3) * dt * speed;
      if (this.burst > 0.01) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const push = this.burst * (40 + p.z * 160) * dt;
        p.x += (dx / len) * push;
        p.y += (dy / len) * push;
      }
      if (p.life < 1) p.life = Math.min(1, p.life + dt * 0.6);
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) {
        this.parts[i] = this.spawn(false);
        continue;
      }
      const lit = this.beam(p.x, p.y);
      const twinkle = 0.55 + 0.45 * Math.sin(time * p.tw + p.ph);
      const alpha = (p.dark ? 0.16 + lit * 0.1 : 0.06 + lit * 0.9) * twinkle * (0.45 + p.z * 0.55) * p.life;
      if (alpha < 0.02) continue;
      const size = p.r * 2 * (p.dark ? 1 : 1 + lit * 0.7);
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.dark ? this.dark : this.light, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.draw(dt, now / 1000);
    this.raf = requestAnimationFrame(this.loop);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

function observeHero(dust) {
  const hero = $('.hero');
  if (!hero || !('IntersectionObserver' in window)) {
    if (dust) dust.start();
    return;
  }
  new IntersectionObserver(([entry]) => {
    state.heroActive = entry.isIntersecting;
    root.classList.toggle('hero-off', !entry.isIntersecting);
    if (!dust) return;
    if (entry.isIntersecting && !doc.hidden) dust.start();
    else dust.stop();
  }).observe(hero);

  doc.addEventListener('visibilitychange', () => {
    if (!dust) return;
    if (doc.hidden) dust.stop();
    else if (state.heroActive) dust.start();
  });
}

/* --------------------------------------------------------------------------
   Lenis smooth scroll, driven by the GSAP ticker
   -------------------------------------------------------------------------- */
function initLenis() {
  if (!LenisCtor) return null;
  const lenis = new LenisCtor({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/* --------------------------------------------------------------------------
   HERO — intro on load
   -------------------------------------------------------------------------- */
const SLICE_SPIN = [-5, 3, 6, 4, -3, -6];
const SLICE_DELAY = [0.03, 0, 0.05, 0.065, 0.02, 0.08];

async function heroIntro() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  const ings = $$('.stage .ing, .near .ing');
  const teglia = $('.teglia');

  // The teglia assembles itself: six slices settle into the tray, then the cut lines appear.
  const tw = teglia ? teglia.offsetWidth : 400;
  tl.fromTo('.teglia__in', { autoAlpha: 0, scale: 0.86, y: 36 }, { autoAlpha: 1, scale: 1, y: 0, duration: 2.2 }, 0);
  tl.fromTo('.teglia__shade', { autoAlpha: 0, scale: 0.72 }, { autoAlpha: 1, scale: 1, duration: 2.2 }, 0.1);
  $$('.teglia .slice').forEach((el, i) => {
    const dx = parseFloat(el.dataset.dx) || 0;
    const dy = parseFloat(el.dataset.dy) || 0;
    tl.fromTo(
      $('.slice__in', el),
      { x: dx * tw * 0.15, y: dy * tw * 0.11, z: tw * 0.28, rotation: SLICE_SPIN[i] * 1.6, rotationX: dy * -12 },
      { x: 0, y: 0, z: 0, rotation: 0, rotationX: 0, duration: 1.9, ease: 'expo.out' },
      0.08 + SLICE_DELAY[i] * 1.6,
    );
  });
  tl.fromTo('.teglia__under', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, 1.35);
  tl.fromTo('.w--pizza .w__i', { yPercent: 112, autoAlpha: 1 }, { yPercent: 0, autoAlpha: 1, duration: 1.8 }, 0.22);
  tl.fromTo('.w--voglia .w__i', { yPercent: 112, autoAlpha: 1 }, { yPercent: 0, autoAlpha: 1, duration: 1.8 }, 0.4);

  const nearBox = $('.near');
  ings.forEach((el, i) => {
    const inner = $('.ing__i', el);
    if (!inner) return;
    const near = el.classList.contains('ing--near');
    const cx = el.offsetLeft + el.offsetWidth / 2;
    const cy = el.offsetTop + el.offsetHeight / 2;
    const dx = near && nearBox ? nearBox.clientWidth / 2 - cx : -cx;
    const dy = near && nearBox ? nearBox.clientHeight / 2 - cy : -cy;
    tl.fromTo(
      inner,
      { autoAlpha: 0, x: dx * 0.6, y: dy * 0.6, scale: 0.25, rotation: (i % 2 ? -1 : 1) * 60 },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 2.1 },
      0.3 + i * 0.045,
    );
  });

  tl.fromTo('.nav', { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: 1.4 }, 0.5);
  tl.fromTo('.hero__tagline .ln__i', { yPercent: 118, autoAlpha: 1 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, stagger: 0.09 }, 0.75);
  tl.fromTo('.hero [data-intro="fade"]', { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.06 }, 0.95);

  // All start states are now inline: safe to lift the CSS pre-hide.
  root.classList.add('is-ready');

  const decoded = Promise.all($$('.slice__top').map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  const fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
  await Promise.race([Promise.all([decoded, fonts]), sleep(1400)]);
  tl.play();
}

/* --------------------------------------------------------------------------
   HERO — scroll “explosion” (sticky hero, scrubbed)
   -------------------------------------------------------------------------- */
function heroScroll(dust) {
  const wrap = $('.hero-wrap');
  if (!wrap) return;
  const stageIngs = $$('.stage .ing');
  const nearIngs = $$('.near .ing');
  const nearBox = $('.near');
  const maxDim = () => Math.max(window.innerWidth, window.innerHeight);
  const dir = (el, near) => {
    const ox = near && nearBox ? nearBox.clientWidth / 2 : 0;
    const oy = near && nearBox ? nearBox.clientHeight * 0.52 : 0;
    const cx = el.offsetLeft + el.offsetWidth / 2 - ox;
    const cy = el.offsetTop + el.offsetHeight / 2 - oy;
    const len = Math.hypot(cx, cy) || 1;
    return { x: cx / len, y: cy / len };
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: wrap,
      start: 'top top',
      end: 'bottom bottom',
      scrub: FINE ? true : 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => { if (dust) dust.kick(Math.abs(self.getVelocity())); },
    },
  });

  // Copy leaves first, so nothing ever travels across it.
  tl.to(['.hero__top', '.hero__aside', '.hero__bottom', '.hero__cue'], { y: -50, autoAlpha: 0, duration: 0.16, ease: 'power1.in' }, 0);
  // The teglia recedes steadily for the whole sequence…
  tl.to('.teglia', { scale: 0.62, yPercent: -12, rotation: -5, duration: 1, ease: 'power1.inOut' }, 0);
  tl.to('.teglia__shade', { autoAlpha: 0.7, duration: 0.6, ease: 'power1.out' }, 0);
  tl.to(['.teglia__under', '.teglia__core'], { autoAlpha: 0, duration: 0.05 }, 0.01);
  // …while “al taglio” happens: each slice parts along its own diagonal, lifts and turns a little, staggered.
  const teglia = $('.teglia');
  const tw = () => (teglia ? teglia.offsetWidth : 0);
  const amp = () => (window.innerWidth < 700 ? 0.68 : 1);
  const shadows = $$('.teglia .sshadow');
  $$('.teglia .slice').forEach((el, i) => {
    const dx = parseFloat(el.dataset.dx) || 0;
    const dy = parseFloat(el.dataset.dy) || 0;
    const sx = () => dx * tw() * 0.085 * amp();
    const sy = () => dy * tw() * 0.07 * amp();
    // its shadow stays on the table and follows in x/y only, softening as the slice lifts
    if (shadows[i]) tl.to(shadows[i], { x: sx, y: sy, scale: 1.06, autoAlpha: 0.72, duration: 0.5, ease: 'power2.out' }, 0.02 + SLICE_DELAY[i]);
    tl.to(el, {
      x: sx,
      y: sy,
      z: () => tw() * (0.045 + (i % 3) * 0.02) * amp(),
      rotation: () => SLICE_SPIN[i] * amp(),
      rotationX: () => dy * -6 * amp(),
      rotationY: () => dx * 7 * amp(),
      duration: 0.5,
      ease: 'power2.out',
    }, 0.02 + SLICE_DELAY[i]);
  });
  // The wordmark parts like a curtain and is gone by mid-scroll (never reaches the nav).
  tl.to('.w--pizza', { yPercent: -22, xPercent: -10, scale: 0.94, autoAlpha: 0, duration: 0.42, ease: 'power1.in' }, 0);
  tl.to('.w--voglia', { yPercent: 22, xPercent: 10, scale: 0.94, autoAlpha: 0, duration: 0.42, ease: 'power1.in' }, 0);

  // Ingredients burst outward immediately (ease-out), at speeds set by their depth.
  stageIngs.forEach((el, i) => {
    const d = parseFloat(el.dataset.depth) || 0.6;
    const far = d < 0.5;
    const reach = () => maxDim() * (far ? 0.24 : 0.55 + d * 0.35);
    tl.to(el, {
      x: () => dir(el).x * reach(),
      y: () => dir(el).y * reach(),
      scale: far ? 0.8 : 1 + d * 0.6,
      rotation: (i % 2 ? -1 : 1) * (far ? 24 : 60 + d * 50),
      duration: 1,
      ease: far ? 'sine.inOut' : 'sine.out',
    }, 0);
  });

  // Near, out-of-focus pieces rush past the camera: they grow fast and leave early.
  nearIngs.forEach((el, i) => {
    const d = parseFloat(el.dataset.depth) || 2;
    tl.to(el, {
      x: () => dir(el, true).x * maxDim() * 0.6,
      y: () => dir(el, true).y * maxDim() * 0.6,
      scale: 1.6 + d * 0.5,
      rotation: (i % 2 ? 1 : -1) * 38,
      duration: 0.55,
      ease: 'power1.in',
    }, 0);
    tl.to(el, { autoAlpha: 0, duration: 0.15, ease: 'none' }, 0.4);
  });
}

/* --------------------------------------------------------------------------
   HERO — pointer / gyro parallax by depth (damped)
   -------------------------------------------------------------------------- */
function initDepthParallax() {
  const items = $$('.stage .ing, .near .ing')
    .map((el) => ({ el: $('.ing__p', el), d: parseFloat(el.dataset.depth) || 0.5 }))
    .concat($$('.w').map((el) => ({ el: $('.w__m', el), d: parseFloat(el.dataset.depth) || 0.3 })))
    .filter((it) => it.el);
  const tilt = $('.teglia__tilt');

  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let lastX = 1;
  let lastY = 1;
  let gyro = false;

  if (FINE) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    root.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
  } else {
    // Gyro where it needs no permission prompt (Android); otherwise a slow autonomous drift.
    const needsPermission = typeof window.DeviceOrientationEvent !== 'undefined'
      && typeof window.DeviceOrientationEvent.requestPermission === 'function';
    if ('DeviceOrientationEvent' in window && !needsPermission) {
      let base = null;
      window.addEventListener('deviceorientation', (e) => {
        if (e.beta == null || e.gamma == null) return;
        gyro = true;
        if (!base) base = { b: e.beta, g: e.gamma };
        base.b += (e.beta - base.b) * 0.004;
        base.g += (e.gamma - base.g) * 0.004;
        tx = clamp((e.gamma - base.g) / 20, -1, 1);
        ty = clamp((e.beta - base.b) / 20, -1, 1);
      }, { passive: true });
      window.addEventListener('orientationchange', () => { base = null; });
    }
  }

  gsap.ticker.add((time, deltaMs) => {
    if (!state.heroActive) return;
    if (!FINE && !gyro) {
      tx = Math.sin(time * 0.33) * 0.5;
      ty = Math.cos(time * 0.26) * 0.35;
    }
    const k = 1 - Math.exp(-(Math.min(deltaMs, 64) / 1000) * 3.2);
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;
    if (Math.abs(cx - lastX) < 0.0004 && Math.abs(cy - lastY) < 0.0004) return;
    lastX = cx;
    lastY = cy;

    const amp = clamp(window.innerWidth * 0.024, 10, 38);
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      it.el.style.transform = `translate3d(${(-cx * it.d * amp).toFixed(2)}px, ${(-cy * it.d * amp).toFixed(2)}px, 0)`;
    }
    if (tilt) tilt.style.transform = `rotateX(${(-cy * 6).toFixed(2)}deg) rotateY(${(cx * 7).toFixed(2)}deg)`;
  });
}

/* --------------------------------------------------------------------------
   N°01 — La storia: horizontal on desktop, vertical sequence on mobile
   -------------------------------------------------------------------------- */
function initStoria() {
  const ring = $('.ring__arc');
  const num = $('.panel__num');
  let ringPlayed = false;
  const ringIn = () => {
    if (ringPlayed) return;
    ringPlayed = true;
    if (ring) gsap.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 25, duration: 2.6, ease: 'expo.out' });
    if (num) {
      const o = { v: 0 };
      gsap.to(o, { v: 75, duration: 2.2, ease: 'expo.out', onUpdate: () => { num.textContent = String(Math.round(o.v)); } });
    }
  };
  if (ring) gsap.set(ring, { strokeDashoffset: 100 });
  if (num) num.textContent = '0';

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (min-height: 600px)', () => {
    const wrap = $('.hx');
    const track = $('.hx__track');
    if (!wrap || !track) return undefined;
    root.classList.add('hx-on');
    const fill = $('.hx__fill');
    const current = $('.hx__current');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const setHeight = () => { wrap.style.height = `${distance() + window.innerHeight}px`; };
    setHeight();
    ScrollTrigger.addEventListener('refreshInit', setHeight);

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        scrub: FINE ? true : 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (fill) fill.style.transform = `scaleX(${self.progress.toFixed(4)})`;
          if (current) current.textContent = String(Math.min(4, Math.round(self.progress * 3) + 1)).padStart(2, '0');
        },
      },
    });

    const panelST = (el, extra = {}) => ({
      trigger: el.closest('.panel'),
      containerAnimation: tween,
      start: 'left right',
      end: 'right left',
      scrub: true,
      invalidateOnRefresh: true,
      ...extra,
    });

    $$('[data-hx-speed]', track).forEach((el) => {
      const s = parseFloat(el.dataset.hxSpeed) || 0;
      gsap.fromTo(el, { x: () => s * window.innerWidth * 0.07 }, { x: () => -s * window.innerWidth * 0.07, ease: 'none', scrollTrigger: panelST(el) });
    });
    $$('.panel__big', track).forEach((el) => {
      gsap.fromTo(el, { x: () => window.innerWidth * 0.05 }, { x: () => -window.innerWidth * 0.05, ease: 'none', scrollTrigger: panelST(el) });
    });

    ScrollTrigger.create({ trigger: wrap, start: 'top 45%', once: true, onEnter: ringIn });

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', setHeight);
      root.classList.remove('hx-on');
      wrap.style.height = '';
    };
  });

  mm.add('(max-width: 1023.98px), (max-height: 599.98px)', () => {
    $$('.hx [data-speed]').forEach((el) => {
      const s = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { yPercent: s * 22 }, {
        yPercent: -s * 22,
        ease: 'none',
        scrollTrigger: { trigger: el.closest('.panel'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    $$('.panel').forEach((panel) => {
      const targets = [$('.panel__big', panel), $('.panel__copy', panel)].filter(Boolean);
      gsap.fromTo(targets, { autoAlpha: 0, y: 48 }, {
        autoAlpha: 1,
        y: 0,
        duration: 1.3,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: { trigger: panel, start: 'top 82%', once: true },
      });
    });
    const p2 = $('.panel--2');
    if (p2) ScrollTrigger.create({ trigger: p2, start: 'top 72%', once: true, onEnter: ringIn });
  });
}

/* --------------------------------------------------------------------------
   Editorial reveals + generic vertical parallax
   -------------------------------------------------------------------------- */
function initReveals() {
  $$('.display, .footer__sign').forEach((heading) => {
    const lines = $$('[data-line]', heading);
    if (!lines.length) return;
    gsap.fromTo(lines, { yPercent: 118 }, {
      yPercent: 0,
      duration: 1.5,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
    });
  });

  const reveals = $$('[data-reveal]');
  gsap.set(reveals, { autoAlpha: 0, y: 34 });
  ScrollTrigger.batch(reveals, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => {
      // After a jump (nav link, End key, scrollbar drag) many elements enter at once:
      // the ones already above the viewport appear instantly, only visible ones are staggered.
      const passed = [];
      const visible = [];
      els.forEach((el) => (el.getBoundingClientRect().bottom < 0 ? passed : visible).push(el));
      if (passed.length) gsap.set(passed, { autoAlpha: 1, y: 0, overwrite: true });
      if (visible.length) {
        gsap.to(visible, {
          autoAlpha: 1,
          y: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: Math.min(0.07, 0.5 / visible.length),
          overwrite: true,
        });
      }
    },
  });

  $$('.kicker__rule').forEach((rule) => {
    gsap.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: rule, start: 'top 92%', once: true } });
  });

  $$('[data-mask]').forEach((mask) => {
    const img = $('img', mask);
    if (!img) return;
    gsap.fromTo(img, { yPercent: 22, scale: 1.1, autoAlpha: 0 }, {
      yPercent: 0,
      scale: 1,
      autoAlpha: 1,
      duration: 1.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: mask, start: 'top 85%', once: true },
    });
  });

  $$('[data-speed]').forEach((el) => {
    if (el.closest('.hx')) return; // handled per layout in initStoria
    const s = parseFloat(el.dataset.speed) || 0;
    const trigger = el.closest('.spread, .tray') || el.parentElement;
    gsap.fromTo(el, { yPercent: s * 16 }, {
      yPercent: -s * 16,
      ease: 'none',
      scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* --------------------------------------------------------------------------
   N°02 — Il territorio: the atlas plate draws itself; a tiny “rally car”
   climbs the Montecchio hairpins with the scroll, tracing the road.
   -------------------------------------------------------------------------- */
function initAtlas() {
  const plate = $('[data-atlas]');
  if (!plate) return;
  const lines = $$('.atlas__line', plate);
  const soft = $$('.atlas__road, .atlas__river, .atlas__compass, .atlas__coords, .atlas__marks > :not(.atlas__car)', plate);
  const labels = $$('.place > span', plate);
  const road = $('#atlas-hairpins', plate);
  const car = $('.atlas__car', plate);

  gsap.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(soft, { autoAlpha: 0 });
  gsap.set(labels, { autoAlpha: 0, y: 12 });
  const draw = gsap.timeline({ paused: true });
  draw.to(lines, { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', stagger: 0.045 }, 0)
    .to(soft, { autoAlpha: 1, duration: 1.2, ease: 'power1.out', stagger: 0.04 }, 0.5)
    .to(labels, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05 }, 0.9);
  ScrollTrigger.create({ trigger: plate, start: 'top 78%', once: true, onEnter: () => draw.play() });

  if (!road || !car) return;
  const len = road.getTotalLength();
  const place = (p) => {
    const pt = road.getPointAtLength(len * p);
    car.setAttribute('cx', pt.x.toFixed(1));
    car.setAttribute('cy', pt.y.toFixed(1));
    road.style.strokeDashoffset = String(1 - p);
  };
  road.style.strokeDasharray = '1';
  place(0);
  ScrollTrigger.create({
    trigger: plate,
    start: 'top 60%',
    end: 'bottom 45%',
    scrub: 0.6,
    onUpdate: (self) => place(self.progress),
  });
}

/* --------------------------------------------------------------------------
   N°04 — Reviews: count-up, distribution bars, topics
   -------------------------------------------------------------------------- */
function initReviews() {
  const scoreEl = $('.score__value [data-count]');
  if (scoreEl) {
    const target = parseFloat(scoreEl.dataset.count) || 0;
    const decimals = parseInt(scoreEl.dataset.decimals || '0', 10);
    const show = (v) => { scoreEl.textContent = v.toFixed(decimals).replace('.', ','); };
    show(0);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: scoreEl,
      start: 'top 85%',
      once: true,
      onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'expo.out', onUpdate: () => show(o.v) }),
    });
  }

  const bars = $$('.dist__bar');
  const counts = $$('.dist__count');
  if (bars.length) {
    gsap.set(bars, { scaleX: 0 });
    const finals = counts.map((c) => parseInt(c.textContent, 10) || 0);
    counts.forEach((c) => { c.textContent = '0'; });
    ScrollTrigger.create({
      trigger: '.dist',
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(bars, { scaleX: 1, duration: 1.8, ease: 'expo.out', stagger: 0.09 });
        counts.forEach((c, i) => {
          const o = { v: 0 };
          gsap.to(o, { v: finals[i], duration: 1.6, delay: i * 0.09, ease: 'expo.out', onUpdate: () => { c.textContent = String(Math.round(o.v)); } });
        });
      },
    });
  }

  const topics = $$('.topics__list li');
  if (topics.length) {
    gsap.fromTo(topics, { autoAlpha: 0, y: 18 }, {
      autoAlpha: 1,
      y: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: '.topics', start: 'top 85%', once: true },
    });
  }
}

/* --------------------------------------------------------------------------
   Themes marquee — slow infinite drift, nudged by scroll velocity
   -------------------------------------------------------------------------- */
function initMarquees() {
  let velocity = 0;
  let lastY = window.scrollY;
  gsap.ticker.add(() => {
    const y = window.scrollY;
    velocity += (Math.abs(y - lastY) - velocity) * 0.12;
    lastY = y;
  });

  $$('[data-marquee]').forEach((marquee) => {
    const track = $('.marquee__track', marquee);
    const group = $('.marquee__group', marquee);
    if (!track || !group) return;
    marquee.classList.add('is-marquee');
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);

    const dir = marquee.classList.contains('marquee--reverse') ? 1 : -1;
    const speed = parseFloat(marquee.dataset.marquee) || 32;
    let width = group.offsetWidth;
    let x = dir === 1 ? -width : 0;
    let visible = false;
    let hover = 0;
    let hoverTarget = 1;

    if ('ResizeObserver' in window) new ResizeObserver(() => { width = group.offsetWidth; }).observe(group);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(marquee);
    } else {
      visible = true;
    }
    marquee.addEventListener('mouseenter', () => { hoverTarget = 0.12; });
    marquee.addEventListener('mouseleave', () => { hoverTarget = 1; });

    gsap.ticker.add((time, deltaMs) => {
      if (!visible || !width) return;
      const dt = Math.min(deltaMs, 64) / 1000;
      hover += (hoverTarget - hover) * Math.min(1, dt * 4);
      const boost = 1 + Math.min(velocity * 0.12, 5);
      x += dir * speed * boost * hover * dt;
      if (x <= -width) x += width;
      if (x > 0) x -= width;
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });
  });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
safe('year', initYear);
safe('status', initStatus);

if (MOTION) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  root.classList.add('has-motion');
  state.lenis = safe('lenis', initLenis) || null;
}

const menu = safe('menu', initMenu) || { close() {}, isOpen: () => false };
safe('anchors', () => initAnchors(menu));
safe('scroll-ui', initScrollUI);
safe('active-states', initActiveStates);

const canvas = $('.hero__dust');
const heroEl = $('.hero');

if (MOTION) {
  const dust = canvas && heroEl ? safe('dust', () => new Dust(canvas, heroEl)) : null;
  safe('hero-observer', () => observeHero(dust));
  safe('hero-intro', () => { heroIntro().catch((err) => { console.warn('[Pizza Voglia] intro', err); root.classList.add('is-ready'); }); });
  safe('hero-scroll', () => {
    const mm = gsap.matchMedia();
    mm.add('(min-height: 540px)', () => { heroScroll(dust); });
  });
  safe('parallax', initDepthParallax);
  safe('storia', initStoria);
  safe('atlas', initAtlas);
  safe('reveals', initReveals);
  safe('reviews', initReviews);
  safe('marquee', initMarquees);

  const refresh = () => ScrollTrigger.refresh();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh).catch(() => {});
  window.addEventListener('load', refresh, { once: true });

  // If the page was opened on a hash, land there once layout is final.
  if (location.hash && location.hash.length > 1) {
    const target = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && state.lenis) {
      window.addEventListener('load', () => requestAnimationFrame(() => state.lenis.scrollTo(target, { immediate: true, force: true })), { once: true });
    }
  }
} else {
  root.classList.add('is-ready', 'is-static');
  // Still frame of flour in the light — no animation loop.
  if (canvas && heroEl) safe('dust-still', () => new Dust(canvas, heroEl));
}
