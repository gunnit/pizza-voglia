/* ==========================================================================
   Pizza Voglia — Opzione A "FORNO" · main.js (ES module)
   - Lenis + GSAP ScrollTrigger (classic scripts, window globals)
   - Three.js hero, loaded with a dynamic import so a CDN failure never
     breaks the rest of the page (the static pizza image stays visible).
   ========================================================================== */

const root = document.documentElement;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const HAS_GSAP = Boolean(gsap && ScrollTrigger);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const ANIM = HAS_GSAP && !REDUCED;
const MQ_WIDE = '(min-width: 900px) and (min-aspect-ratio: 1/1)';
const ASSETS = '../../assets/img/';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const debounce = (fn, ms = 150) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

function safe(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[forno] ${name}:`, err);
    return undefined;
  }
}

/* --------------------------------------------------------------------------
   Smooth scroll (Lenis ⇄ ScrollTrigger)
   -------------------------------------------------------------------------- */
let lenis = null;

function initSmoothScroll() {
  if (!ANIM || typeof window.Lenis !== 'function') return;
  lenis = new window.Lenis({
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.15,
    autoRaf: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(el) {
  const nav = $('#nav');
  const isTop = el.id === 'top' || el.id === 'main';
  const offset = isTop ? 0 : -((nav && nav.offsetHeight) || 0) + 1;
  if (lenis) {
    lenis.scrollTo(isTop ? 0 : el, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    const y = isTop ? 0 : el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
  }
}

/* --------------------------------------------------------------------------
   Anchors (smooth + focus management)
   -------------------------------------------------------------------------- */
let closeMobileMenu = () => {};

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!hash || hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMobileMenu(false);
    scrollToTarget(target);
    if (history.replaceState) history.replaceState(null, '', hash);
    const focusEl = target.id === 'top' ? $('#main') : target;
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
    }
  });
}

/* --------------------------------------------------------------------------
   Nav: glass on scroll, hide on scroll down, active section
   -------------------------------------------------------------------------- */
let menuOpen = false;

function initNav() {
  const nav = $('#nav');
  if (!nav) return;
  let lastY = window.scrollY;
  const update = (y) => {
    nav.classList.toggle('is-scrolled', y > 24);
    if (!menuOpen) {
      if (y > window.innerHeight * 0.9 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < window.innerHeight * 0.5) nav.classList.remove('is-hidden');
    }
    lastY = y;
  };
  if (lenis) lenis.on('scroll', (l) => update(l.scroll));
  else window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
  update(window.scrollY);
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  const links = $$('[data-nav]', nav);
  const sections = $$('main section[id]');
  if (!('IntersectionObserver' in window) || !links.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === id));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((s) => io.observe(s));
}

/* --------------------------------------------------------------------------
   Mobile menu
   -------------------------------------------------------------------------- */
function initMobileMenu() {
  const btn = $('.nav__burger');
  const menu = $('#mobile-menu');
  const nav = $('#nav');
  if (!btn || !menu) return;
  const label = $('.sr-only', btn);
  let hideTimer;

  const focusables = () => [btn, ...$$('a, button', menu)];
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables();
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  function open() {
    if (menuOpen) return;
    menuOpen = true;
    clearTimeout(hideTimer);
    menu.hidden = false;
    void menu.offsetWidth;
    menu.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    root.classList.add('menu-open');
    if (label) label.textContent = 'Chiudi il menu di navigazione';
    if (nav) nav.classList.remove('is-hidden');
    if (lenis) lenis.stop();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    setTimeout(() => {
      const first = $('a', menu);
      if (first && menuOpen) first.focus({ preventScroll: true });
    }, 350);
  }

  function close(returnFocus = true) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    root.classList.remove('menu-open');
    if (label) label.textContent = 'Apri il menu di navigazione';
    if (lenis) lenis.start();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    hideTimer = setTimeout(() => {
      if (!menuOpen) menu.hidden = true;
    }, 800);
    if (returnFocus) btn.focus({ preventScroll: true });
  }

  closeMobileMenu = close;
  btn.addEventListener('click', () => (menuOpen ? close() : open()));
  const mq = window.matchMedia('(min-width: 900px)');
  const onMq = (e) => {
    if (e.matches) close(false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onMq);
}

/* --------------------------------------------------------------------------
   Opening hours (Europe/Rome) — live status + today's row
   -------------------------------------------------------------------------- */
const SCHEDULE = {
  0: [[17 * 60, 20 * 60 + 30]],
  1: [[11 * 60, 13 * 60 + 30], [17 * 60 + 30, 20 * 60 + 30]],
  2: [[11 * 60, 13 * 60 + 30], [17 * 60 + 30, 20 * 60 + 30]],
  3: [[11 * 60, 13 * 60 + 30], [17 * 60 + 30, 20 * 60 + 30]],
  4: [[11 * 60, 13 * 60 + 30], [17 * 60 + 30, 20 * 60 + 30]],
  5: [[11 * 60, 13 * 60 + 30], [17 * 60 + 30, 20 * 60 + 30]],
  6: [[17 * 60, 20 * 60 + 30]],
};

function romeNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = {};
  fmt.formatToParts(date).forEach((p) => {
    parts[p.type] = p.value;
  });
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hour = parseInt(parts.hour, 10) % 24;
  return { day, minutes: hour * 60 + parseInt(parts.minute, 10) };
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function computeStatus() {
  const { day, minutes } = romeNow();
  const slots = SCHEDULE[day] || [];
  for (const [open, close] of slots) {
    if (minutes >= open && minutes < close) {
      const left = close - minutes;
      if (left <= 30) return { day, state: 'soon', text: `Aperto · chiude alle ${hhmm(close)}` };
      return { day, state: 'open', text: `Aperto ora · chiude alle ${hhmm(close)}` };
    }
    if (minutes < open) return { day, state: 'closed', text: `Chiuso · apre alle ${hhmm(open)}` };
  }
  const next = SCHEDULE[(day + 1) % 7][0][0];
  return { day, state: 'closed', text: `Chiuso · apre domani alle ${hhmm(next)}` };
}

function initHours() {
  const apply = () => {
    const s = computeStatus();
    $$('[data-status]').forEach((el) => {
      el.dataset.state = s.state;
    });
    $$('[data-status-text]').forEach((el) => {
      if (el.textContent !== s.text) el.textContent = s.text;
    });
    $$('.hours tr[data-day]').forEach((tr) => {
      const today = Number(tr.dataset.day) === s.day;
      tr.classList.toggle('is-today', today);
      const th = $('th', tr);
      let badge = $('.hours__today', tr);
      if (today && !badge && th) {
        badge = document.createElement('span');
        badge.className = 'hours__today';
        badge.textContent = 'Oggi';
        th.appendChild(badge);
      } else if (!today && badge) {
        badge.remove();
      }
    });
  };
  apply();
  setInterval(apply, 60 * 1000);
}

/* --------------------------------------------------------------------------
   Text splitting helpers
   -------------------------------------------------------------------------- */
function collectWords(el) {
  const words = [];
  let cur = null;
  const push = (node) => {
    if (!cur) {
      cur = [];
      words.push(cur);
    }
    cur.push(node);
  };
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) cur = null;
        else push(document.createTextNode(part));
      });
    } else if (node.nodeType === 1) {
      if (node.tagName === 'BR') {
        cur = null;
        return;
      }
      push(node);
    }
  });
  return words;
}

/** Wrap each word in a clipping mask; returns the moving inner spans in order. */
function splitWords(el, { a11y = true } = {}) {
  if (el.dataset.splitDone) return $$('.w-in', el);
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const words = collectWords(el);
  el.textContent = '';
  const holder = a11y ? document.createElement('span') : el;
  if (a11y) holder.setAttribute('aria-hidden', 'true');
  const inners = [];
  words.forEach((pieces, i) => {
    const mask = document.createElement('span');
    mask.className = 'w-mask';
    const inner = document.createElement('span');
    inner.className = 'w-in';
    pieces.forEach((p) => inner.appendChild(p));
    mask.appendChild(inner);
    holder.appendChild(mask);
    if (i < words.length - 1) holder.appendChild(document.createTextNode(' '));
    inners.push(inner);
  });
  if (a11y) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.append(sr, holder);
  }
  el.dataset.splitDone = '1';
  return inners;
}

/** Plain word spans (no masks) for the scroll-scrubbed statement. */
function splitPlainWords(el) {
  if (el.dataset.splitDone) return $$('.wd', el);
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const out = [];
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'wd';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    out.push(s);
  });
  el.dataset.splitDone = '1';
  return out;
}

/** Split a numeral's digits into chars; units (%, ★) stay whole. */
function splitNumeral(el) {
  if (!el) return [];
  if (el.dataset.splitDone) return $$('.c, .numeral__unit, .numeral__star', el);
  const out = [];
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        if (!ch.trim()) continue;
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        frag.appendChild(c);
        out.push(c);
      }
      node.replaceWith(frag);
    } else if (node.nodeType === 1) {
      if (node.tagName.toLowerCase() === 'svg') node.style.display = 'inline-block';
      out.push(node);
    }
  });
  el.classList.add('is-split');
  el.dataset.splitDone = '1';
  return out;
}

/* --------------------------------------------------------------------------
   Hero intro (word reveal)
   -------------------------------------------------------------------------- */
function initHeroIntro() {
  const hero = $('.hero');
  if (!hero) return;
  const words = [];
  $$('.hero__line', hero).forEach((line) => {
    words.push(...splitWords(line, { a11y: false }));
  });
  if (!ANIM) return;

  const overline = $('.hero__overline', hero);
  const sub = $('.hero__sub', hero);
  const ctas = $$('.hero__ctas > *', hero);
  const chips = $$('.hero__chips > *', hero);
  const cue = $('.hero__cue', hero);
  const fades = [overline, sub, ...ctas, ...chips, cue].filter(Boolean);

  gsap.set(words, { yPercent: 118, rotate: 5, transformOrigin: '0% 100%' });
  gsap.set(fades, { opacity: 0, y: 20 });

  const tl = gsap.timeline({ delay: 0.2, defaults: { ease: 'expo.out' } });
  tl.to(overline, { opacity: 1, y: 0, duration: 1.1 }, 0)
    .to(words, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.09 }, 0.08)
    .to(sub, { opacity: 1, y: 0, duration: 1.2 }, 0.55)
    .to(ctas, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.7)
    .to(chips, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.82);
  if (cue) {
    tl.to(cue, { opacity: 1, y: 0, duration: 1 }, 1.05);
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: '+=180',
      onUpdate: (self) => gsap.set(cue, { autoAlpha: 1 - self.progress }),
    });
  }
}

/* --------------------------------------------------------------------------
   Section reveals
   -------------------------------------------------------------------------- */
function initReveals() {
  const headings = $$('[data-split]');
  const groups = headings.map((el) => ({ el, words: splitWords(el) }));
  if (!ANIM) return;

  groups.forEach(({ el, words }) => {
    gsap.set(words, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07 }),
    });
  });

  const items = $$('[data-reveal]');
  gsap.set(items, { opacity: 0, y: 40 });
  ScrollTrigger.batch(items, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.15, ease: 'power3.out', stagger: 0.09, overwrite: true }),
  });
  // Keyboard users: reveal anything that receives focus before its trigger fired.
  document.addEventListener('focusin', (e) => {
    const r = e.target.closest && e.target.closest('[data-reveal]');
    if (r && Number(gsap.getProperty(r, 'opacity')) < 1) gsap.to(r, { opacity: 1, y: 0, duration: 0.4, overwrite: true });
  });
}

/* --------------------------------------------------------------------------
   Statement: words light up with scroll
   -------------------------------------------------------------------------- */
function initStatement() {
  const el = $('[data-words]');
  if (!el) return;
  const words = splitPlainWords(el);
  if (!ANIM) return;
  gsap.fromTo(
    words,
    { opacity: 0.14 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
    }
  );
}

/* --------------------------------------------------------------------------
   Story: sticky numeral reel (desktop) / stacked numerals (mobile)
   -------------------------------------------------------------------------- */
function initStory() {
  const steps = $$('.step');
  const items = $$('.reel__item');
  if (!steps.length || !items.length) return;
  const reelChars = items.map((item) => splitNumeral($('.numeral', item)));
  const caption = $('[data-reel-caption]');
  const count = $('[data-reel-count]');
  const bar = $('[data-reel-bar]');
  let active = 0;

  if (ANIM) {
    items.forEach((item, i) => {
      if (i !== 0) gsap.set(reelChars[i], { yPercent: 110 });
    });
  }

  const setActive = (i) => {
    if (i === active) return;
    const prev = active;
    active = i;
    const dir = i > prev ? 1 : -1;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    if (count) count.textContent = String(i + 1).padStart(2, '0');
    if (caption) caption.textContent = steps[i].dataset.caption || '';
    if (!ANIM) {
      items.forEach((it, k) => it.classList.toggle('is-active', k === i));
      if (bar) bar.style.transform = `scaleX(${(i + 1) / steps.length})`;
      return;
    }
    gsap.to(bar, { scaleX: (i + 1) / steps.length, duration: 0.9, ease: 'expo.out' });
    gsap.killTweensOf(reelChars[prev]);
    gsap.killTweensOf(reelChars[i]);
    gsap.to(reelChars[prev], {
      yPercent: -110 * dir,
      duration: 0.7,
      ease: 'expo.in',
      stagger: 0.035,
      onComplete: () => {
        if (active !== prev) items[prev].classList.remove('is-active');
      },
    });
    items[i].classList.add('is-active');
    gsap.fromTo(
      reelChars[i],
      { yPercent: 110 * dir },
      { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05, delay: 0.32 }
    );
    if (caption) gsap.fromTo(caption, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' });
  };

  if (!HAS_GSAP) {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(steps.indexOf(e.target));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    steps.forEach((s) => io.observe(s));
    return;
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px)', () => {
    const triggers = steps.map((step, i) =>
      ScrollTrigger.create({
        trigger: step,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => {
          if (self.isActive) setActive(i);
        },
      })
    );
    return () => triggers.forEach((t) => t.kill());
  });
  if (ANIM) {
    mm.add('(max-width: 1023px)', () => {
      const tweens = steps.map((step) => {
        const chars = splitNumeral($('.step__numeral .numeral', step));
        return gsap.from(chars, {
          yPercent: 100,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.06,
          scrollTrigger: { trigger: step, start: 'top 82%', once: true },
        });
      });
      return () => tweens.forEach((t) => t.scrollTrigger && t.scrollTrigger.kill());
    });
  }
}

/* --------------------------------------------------------------------------
   3D tilt card (slice) + parallax
   -------------------------------------------------------------------------- */
function initCard3D() {
  const card = $('[data-tilt]');
  if (!card) return;
  const inner = $('.card3d__inner', card);
  const img = $('.card3d__img', card);
  if (ANIM && img) {
    gsap.fromTo(
      img,
      { '--py': '46px' },
      {
        '--py': '-46px',
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  }
  if (!FINE || REDUCED || !inner) return;
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    inner.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
    inner.style.setProperty('--rx', `${((0.5 - y) * 12).toFixed(2)}deg`);
    inner.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    inner.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    card.classList.add('is-hover');
  });
  card.addEventListener('pointerleave', () => {
    inner.style.setProperty('--rx', '0deg');
    inner.style.setProperty('--ry', '0deg');
    card.classList.remove('is-hover');
  });
}

/* --------------------------------------------------------------------------
   Menu: accordion on mobile, floating ingredient on desktop hover
   -------------------------------------------------------------------------- */
function initMenu() {
  const cats = $$('.menu-cat');
  const mqDesk = window.matchMedia('(min-width: 900px)');
  const applyMode = () => {
    cats.forEach((c, i) => {
      c.open = mqDesk.matches ? true : i === 0;
    });
  };
  applyMode();
  if (mqDesk.addEventListener) mqDesk.addEventListener('change', applyMode);
  cats.forEach((c) => {
    const summary = $('summary', c);
    if (summary) {
      summary.addEventListener('click', (e) => {
        if (mqDesk.matches) e.preventDefault();
      });
    }
    c.addEventListener('toggle', debounce(() => HAS_GSAP && ScrollTrigger.refresh(), 120));
  });

  const float = $('.menu-float');
  if (!float) return;
  if (!FINE || REDUCED || !HAS_GSAP) {
    float.remove();
    return;
  }
  document.body.appendChild(float);
  const img = $('img', float);
  const targets = $$('.dish[data-img]');
  let preloaded = false;
  const preload = () => {
    if (preloaded) return;
    preloaded = true;
    new Set(targets.map((t) => t.dataset.img)).forEach((src) => {
      const im = new Image();
      im.src = src;
    });
  };
  const menuSection = $('#menu');
  if (menuSection) menuSection.addEventListener('pointerenter', preload, { once: true });

  gsap.set(float, { scale: 0.5, x: -400, y: -400 });
  const xTo = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3' });
  const rTo = gsap.quickTo(float, 'rotation', { duration: 0.9, ease: 'power3' });
  let shown = false;
  let current = '';
  let hideT;
  let lastX = 0;

  const show = (src) => {
    clearTimeout(hideT);
    if (src !== current) {
      img.src = src;
      current = src;
      if (shown) gsap.fromTo(img, { scale: 0.82 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
    }
    if (!shown) {
      shown = true;
      gsap.to(float, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.7)', overwrite: 'auto' });
    }
  };
  const hide = () => {
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      shown = false;
      gsap.to(float, { autoAlpha: 0, scale: 0.5, duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
    }, 70);
  };
  targets.forEach((t) => {
    t.addEventListener('pointerenter', () => show(t.dataset.img));
    t.addEventListener('pointerleave', hide);
  });
  window.addEventListener(
    'pointermove',
    (e) => {
      const flip = e.clientX > window.innerWidth - 300;
      xTo(e.clientX + (flip ? -150 : 150));
      yTo(e.clientY - 40);
      rTo(clamp((e.clientX - lastX) * 0.8, -20, 20));
      lastX = e.clientX;
    },
    { passive: true }
  );
}

/* --------------------------------------------------------------------------
   Reviews: animated distribution + pointer glow
   -------------------------------------------------------------------------- */
function initReviews() {
  $$('.theme').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
      card.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
    });
  });
  if (!ANIM) return;
  const score = $('.score');
  if (!score) return;
  const bars = $$('.dist__bar', score);
  const counters = $$('[data-count]', score);
  const starsFill = $('.stars__fill', score);
  gsap.set(bars, { scaleX: 0 });
  counters.forEach((el) => {
    el.textContent = el.dataset.decimals ? '0,0' : '0';
  });
  if (starsFill) gsap.set(starsFill, { width: '0%' });
  ScrollTrigger.create({
    trigger: score,
    start: 'top 78%',
    once: true,
    onEnter: () => {
      gsap.to(bars, { scaleX: 1, duration: 1.5, ease: 'expo.out', stagger: 0.09, delay: 0.25 });
      if (starsFill) gsap.to(starsFill, { width: '96%', duration: 1.8, ease: 'power3.out', delay: 0.2 });
      counters.forEach((el) => {
        const end = parseFloat(el.dataset.count);
        const dec = parseInt(el.dataset.decimals || '0', 10);
        const o = { v: 0 };
        gsap.to(o, {
          v: end,
          duration: 1.8,
          delay: 0.2,
          ease: 'power3.out',
          onUpdate: () => {
            el.textContent = o.v.toFixed(dec).replace('.', ',');
          },
        });
      });
    },
  });
}

/* --------------------------------------------------------------------------
   Buffet band: velocity-reactive marquee + floating ingredients
   -------------------------------------------------------------------------- */
function initBuffet() {
  if (!ANIM) return;
  const marquee = $('.marquee');
  const track = $('.marquee__track');
  if (marquee && track) {
    marquee.classList.add('is-js');
    const tween = gsap.to(track, { xPercent: -50, duration: 44, ease: 'none', repeat: -1 });
    let boost = 0;
    let speed = 1;
    if (lenis) {
      lenis.on('scroll', (l) => {
        boost = Math.max(boost, clamp(Math.abs(l.velocity) * 0.18, 0, 7));
      });
    }
    gsap.ticker.add(() => {
      speed = lerp(speed, 1 + boost, 0.08);
      boost *= 0.9;
      tween.timeScale(speed);
    });
    ScrollTrigger.create({
      trigger: marquee,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? tween.play() : tween.pause()),
    });
  }
  $$('.floater').forEach((el, i) => {
    const amp = 70 + i * 26;
    gsap.fromTo(
      el,
      { y: amp },
      {
        y: -amp,
        ease: 'none',
        scrollTrigger: { trigger: '.buffet', start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  });
}

/* --------------------------------------------------------------------------
   Footer: fit giant wordmark + scroll fill, year
   -------------------------------------------------------------------------- */
function initFooter() {
  $$('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
  const word = $('[data-fit]');
  if (!word) return;
  const box = word.parentElement;
  const fit = () => {
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (avail <= 0) return;
    // Iterate: glyph widths are not perfectly linear in font-size (variable font axes).
    let size = 100;
    for (let i = 0; i < 4; i++) {
      word.style.setProperty('--fit-size', `${size.toFixed(2)}px`);
      const w = word.getBoundingClientRect().width;
      if (!w) return;
      const next = size * (avail / w) * 0.997;
      if (Math.abs(next - size) < 0.2) break;
      size = next;
    }
    word.style.setProperty('--fit-size', `${size.toFixed(2)}px`);
  };
  fit();
  // Re-fit once the display face is really there (fonts.ready can resolve before it is requested).
  if (document.fonts) {
    if (document.fonts.load) document.fonts.load('800 100px Fraunces').then(fit, fit);
    if (document.fonts.ready) document.fonts.ready.then(fit);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fit);
  }
  window.addEventListener('load', fit);
  window.addEventListener('resize', debounce(fit, 150));
  if (ANIM) {
    gsap.fromTo(
      word,
      { '--fill': '0%' },
      {
        '--fill': '100%',
        ease: 'none',
        scrollTrigger: { trigger: word, start: 'top bottom', end: 'max', scrub: 0.8 },
      }
    );
  }
}

/* --------------------------------------------------------------------------
   Ember cursor (fine pointers only)
   -------------------------------------------------------------------------- */
function initCursor() {
  if (!FINE || REDUCED) return;
  const dot = document.createElement('div');
  dot.className = 'cursor';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ring);
  root.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let rx = -100;
  let ry = -100;
  let started = false;
  const HOVER = 'a, button, summary, [data-tilt], .dish[data-img], .dist__row, label';

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!started) {
        rx = x;
        ry = y;
        started = true;
      }
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      root.classList.add('cursor-on');
    },
    { passive: true }
  );
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    ring.classList.toggle('is-hover', Boolean(t && t.closest && t.closest(HOVER)));
  });
  root.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
  window.addEventListener('blur', () => root.classList.remove('cursor-on'));
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
  $$('iframe').forEach((f) => f.addEventListener('pointerenter', () => root.classList.remove('cursor-on')));

  const tick = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
  };
  if (HAS_GSAP) gsap.ticker.add(tick);
  else {
    const loop = () => {
      tick();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

/* --------------------------------------------------------------------------
   Magnetic buttons
   -------------------------------------------------------------------------- */
function initMagnetic() {
  if (!FINE || !ANIM) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.45)' });
    });
  });
}

/* ==========================================================================
   HERO 3D — Three.js
   ========================================================================== */
function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch (err) {
    return false;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Immagine non caricata: ${src}`));
    im.src = src;
  });
}

/* Separable box blur (3 passes ≈ gaussian) on a Float32 field. */
function boxBlur(src, S, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * r + 1;
  const last = S - 1;
  for (let y = 0; y < S; y++) {
    const row = y * S;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, last)];
    for (let x = 0; x < S; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(last, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < S; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, last) * S + x];
    for (let y = 0; y < S; y++) {
      out[y * S + x] = acc / k;
      acc += tmp[Math.min(last, y + r + 1) * S + x] - tmp[Math.max(0, y - r) * S + x];
    }
  }
  return out;
}
const gaussBlur = (src, S, r) => boxBlur(boxBlur(boxBlur(src, S, r), S, r), S, r);

function circularSmooth(arr, k, passes) {
  const n = arr.length;
  for (let p = 0; p < passes; p++) {
    const copy = arr.slice();
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let j = -k; j <= k; j++) acc += copy[(i + j + n) % n];
      arr[i] = acc / (2 * k + 1);
    }
  }
}

/**
 * Derive relief maps from the top-down pizza photo:
 * - finds the sauce boundary per angle (polar density histogram) → cornicione ring
 * - height = puffy rounded crust profile + raised cheese/basil + fine detail
 * - normal map (for lighting), and a packed map: R = oil/clearcoat mask, G = roughness
 */
async function analyzePizza(img, S, crustH) {
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, S, S);
  const src = ctx.getImageData(0, 0, S, S).data;
  const N = S * S;
  const sc = S / 512;
  const R = (v) => Math.max(1, Math.round(v * sc));

  const A = new Float32Array(N);
  const L = new Float32Array(N);
  const TOP = new Float32Array(N);
  const CH = new Float32Array(N);
  const BA = new Float32Array(N);
  const SA = new Float32Array(N);
  const DARK = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const r = src[p] / 255;
    const g = src[p + 1] / 255;
    const b = src[p + 2] / 255;
    const a = src[p + 3] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx > 1e-4 ? (mx - mn) / mx : 0;
    A[i] = a;
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const redness = (r - Math.max(g, b)) / Math.max(r, 1e-3);
    const sauce = smoothstep(0.48, 0.6, redness) * smoothstep(0.2, 0.35, mx);
    const basil = smoothstep(0.04, 0.18, (g - r) / Math.max(g, 1e-3)) * a;
    const cheese = smoothstep(0.62, 0.8, mx) * (1 - smoothstep(0.2, 0.45, sat)) * a;
    TOP[i] = Math.min(1, sauce + basil);
    SA[i] = sauce * a;
    BA[i] = basil;
    CH[i] = cheese;
    DARK[i] = (1 - smoothstep(0.12, 0.38, mx)) * a;
  }
  await nextFrame();

  // Polar histogram → sauce boundary (rho) and silhouette (redge) per angle.
  const NA = 180;
  const NR = 128;
  const half = S / 2;
  const cnt = new Float32Array(NA * NR);
  const tot = new Float32Array(NA * NR);
  const acnt = new Float32Array(NA * NR);
  const RR = new Float32Array(N);
  const TH = new Float32Array(N);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const dx = x - half + 0.5;
      const dy = y - half + 0.5;
      const rr = Math.sqrt(dx * dx + dy * dy) / half;
      const th = Math.atan2(dy, dx);
      RR[i] = rr;
      TH[i] = th;
      const ai = Math.floor(((th + Math.PI) / (2 * Math.PI)) * NA) % NA;
      const ri = Math.min(NR - 1, Math.floor(rr * NR));
      const k = ai * NR + ri;
      tot[k] += 1;
      cnt[k] += TOP[i];
      acnt[k] += A[i];
    }
  }
  const rho = new Float32Array(NA);
  const redge = new Float32Array(NA);
  for (let a = 0; a < NA; a++) {
    rho[a] = 0.82;
    redge[a] = 0.985;
    for (let r = NR - 1; r >= 0; r--) {
      const k = a * NR + r;
      if (tot[k] > 0 && cnt[k] / tot[k] > 0.45) {
        rho[a] = (r + 1) / NR;
        break;
      }
    }
    for (let r = NR - 1; r >= 0; r--) {
      const k = a * NR + r;
      if (tot[k] > 0 && acnt[k] / tot[k] > 0.5) {
        redge[a] = (r + 1) / NR;
        break;
      }
    }
  }
  circularSmooth(rho, 3, 3);
  circularSmooth(redge, 2, 2);
  await nextFrame();

  // Crust profile per pixel.
  const PROF = new Float32Array(N);
  const RING = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const fa = ((TH[i] + Math.PI) / (2 * Math.PI)) * NA - 0.5;
    const fl = Math.floor(fa);
    const f = fa - fl;
    const i0 = ((fl % NA) + NA) % NA;
    const i1 = (i0 + 1) % NA;
    const rh = rho[i0] * (1 - f) + rho[i1] * f;
    const re = redge[i0] * (1 - f) + redge[i1] * f;
    const rr = RR[i];
    if (rr > rh) {
      const t = clamp((rr - rh) / Math.max(re - rh, 1e-3), 0, 1);
      const u = 2 * t - 1;
      PROF[i] = Math.pow(Math.max(0, 1 - u * u), 0.55);
      RING[i] = 1;
    }
  }
  const inner = new Float32Array(N);
  for (let i = 0; i < N; i++) inner[i] = 1 - RING[i];
  const chB = gaussBlur(CH.map((v, i) => v * inner[i]), S, R(2));
  await nextFrame();
  const baB = gaussBlur(BA.map((v, i) => v * inner[i]), S, R(1));
  const Lb = gaussBlur(L, S, R(3));
  await nextFrame();
  const aB = gaussBlur(A, S, R(2));
  const ringSoft = gaussBlur(RING, S, R(3));
  await nextFrame();

  let H = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const detail = L[i] - Lb[i];
    H[i] = PROF[i] * (1 + detail * 0.6) + chB[i] * 0.16 + baB[i] * 0.07;
  }
  H = gaussBlur(H, S, R(2));
  let maxH = 1e-4;
  for (let i = 0; i < N; i++) {
    H[i] *= smoothstep(0.3, 0.9, aB[i]);
    if (H[i] > maxH) maxH = H[i];
  }
  for (let i = 0; i < N; i++) H[i] /= maxH;
  await nextFrame();

  // Output canvases.
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    return c;
  };
  const heightCv = mk();
  const normalCv = mk();
  const ormCv = mk();
  const hImg = heightCv.getContext('2d').createImageData(S, S);
  const nImg = normalCv.getContext('2d').createImageData(S, S);
  const oImg = ormCv.getContext('2d').createImageData(S, S);

  // Normal map from the displaced height plus fine luminance detail.
  const fine = gaussBlur(L, S, 1);
  const px = 2 / S;
  const hn = new Float32Array(N);
  for (let i = 0; i < N; i++) hn[i] = H[i] * crustH + (L[i] - fine[i]) * A[i] * 0.004;
  const last = S - 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const xl = y * S + Math.max(0, x - 1);
      const xr = y * S + Math.min(last, x + 1);
      const yu = Math.max(0, y - 1) * S + x;
      const yd = Math.min(last, y + 1) * S + x;
      const dhdx = (hn[xr] - hn[xl]) / (2 * px);
      const dhdyUp = -(hn[yd] - hn[yu]) / (2 * px);
      let nx = -dhdx;
      let ny = -dhdyUp;
      let nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const p = i * 4;
      nImg.data[p] = (nx * 0.5 + 0.5) * 255;
      nImg.data[p + 1] = (ny * 0.5 + 0.5) * 255;
      nImg.data[p + 2] = (nz * 0.5 + 0.5) * 255;
      nImg.data[p + 3] = 255;

      const hv = H[i] * 255;
      hImg.data[p] = hv;
      hImg.data[p + 1] = hv;
      hImg.data[p + 2] = hv;
      hImg.data[p + 3] = 255;

      // R: oily clearcoat on sauce & cheese; G: roughness (crust dry, toppings glossy)
      const ring = ringSoft[i];
      const oil = clamp((SA[i] * 0.9 + CH[i] * 0.75 + BA[i] * 0.45) * (1 - ring), 0, 1);
      const rough = clamp(0.46 - 0.08 * CH[i] - 0.05 * SA[i] + ring * 0.38 + DARK[i] * 0.12, 0.28, 0.95);
      oImg.data[p] = oil * 255;
      oImg.data[p + 1] = rough * 255;
      oImg.data[p + 2] = 0;
      oImg.data[p + 3] = 255;
    }
  }
  heightCv.getContext('2d').putImageData(hImg, 0, 0);
  normalCv.getContext('2d').putImageData(nImg, 0, 0);
  ormCv.getContext('2d').putImageData(oImg, 0, 0);
  return { height: heightCv, normal: normalCv, orm: ormCv };
}

/* Polar disc with interior vertices, denser rings on the cornicione. */
function makeDiscGeometry(THREE, rings, segs) {
  const M = 1024;
  const cum = new Float32Array(M + 1);
  let total = 0;
  for (let i = 1; i <= M; i++) {
    const r = i / M;
    total += (1 + 3.4 * smoothstep(0.55, 0.82, r)) / M;
    cum[i] = total;
  }
  const radii = [0];
  let j = 0;
  for (let k = 1; k <= rings; k++) {
    const target = (k / rings) * total;
    while (j < M - 1 && cum[j + 1] < target) j++;
    const f = (target - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    radii.push(Math.min(1, (j + clamp(f, 0, 1)) / M));
  }
  const vCount = 1 + rings * (segs + 1);
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const nor = new Float32Array(vCount * 3);
  uv[0] = 0.5;
  uv[1] = 0.5;
  nor[2] = 1;
  let v = 1;
  for (let k = 1; k <= rings; k++) {
    const r = radii[k];
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      pos[v * 3] = x;
      pos[v * 3 + 1] = y;
      uv[v * 2] = 0.5 + x * 0.5;
      uv[v * 2 + 1] = 0.5 + y * 0.5;
      nor[v * 3 + 2] = 1;
      v++;
    }
  }
  const idx = [];
  for (let s = 0; s < segs; s++) idx.push(0, 1 + s, 2 + s);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * (segs + 1);
    const b0 = 1 + k * (segs + 1);
    for (let s = 0; s < segs; s++) {
      const a = a0 + s;
      const b = b0 + s;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* Baked-dough underside: lathe with a rounded edge. */
function makeUnderside(THREE) {
  const pts = [
    [0.0, -0.05],
    [0.45, -0.052],
    [0.74, -0.05],
    [0.86, -0.044],
    [0.92, -0.034],
    [0.952, -0.02],
    [0.968, -0.004],
    [0.972, 0.012],
    [0.962, 0.03],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const geo = new THREE.LatheGeometry(pts, 180);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeUndersideCanvas(W = 512, Hh = 128) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, '#8a4f22');
  grad.addColorStop(0.18, '#b4743c');
  grad.addColorStop(0.55, '#cf9a5e');
  grad.addColorStop(1, '#ddb07a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, Hh);
  // flour speckles
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255, 238, 210, ${(Math.random() * 0.18).toFixed(3)})`;
    g.fillRect(Math.random() * W, Math.random() * Hh, 1.2, 1.2);
  }
  // char spots (more toward the rim = top rows)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const y = Math.pow(Math.random(), 1.8) * Hh;
    const r = 2 + Math.random() * 9;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(40, 20, 10, 0.85)');
    rg.addColorStop(0.55, 'rgba(70, 36, 16, 0.45)');
    rg.addColorStop(1, 'rgba(70, 36, 16, 0)');
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function makeEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x090504);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (hex, intensity, w, h, x, y, z) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, 1);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(0xffe0b8, 5, 7, 4.5, -5, 6.5, 5);
  panel(0xff5a1f, 7, 11, 1.6, 5.5, 1.5, -6);
  panel(0xe7b35a, 2.2, 12, 3, 0, -7, 2);
  panel(0xfff1de, 1.6, 3, 3, 6, 5, 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  geo.dispose();
  env.traverse((o) => {
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}

const EMBER_VS = /* glsl */ `
  uniform float uTime;
  uniform vec3 uArea;
  uniform vec3 uCenter;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uIntensity;
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aScale;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float life = fract(position.y + uTime * aSpeed);
    float t = uTime * (0.35 + aSeed * 0.5) + aSeed * 40.0;
    vec3 p;
    p.x = position.x * uArea.x + sin(t) * 0.38 * life + sin(t * 2.7 + aSeed * 9.0) * 0.08;
    p.y = (life * 2.0 - 1.0) * uArea.y;
    p.z = position.z * uArea.z + cos(t * 0.8) * 0.3 * life;
    p += uCenter;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float fade = smoothstep(0.0, 0.14, life) * (1.0 - smoothstep(0.5, 1.0, life));
    float flicker = 0.6 + 0.4 * sin(uTime * (5.0 + aSeed * 9.0) + aSeed * 50.0);
    vAlpha = fade * flicker * uIntensity;
    vHeat = 1.0 - life;
    gl_PointSize = uSize * aScale * uPixelRatio * (1.0 - life * 0.45) / max(0.1, -mv.z);
  }
`;

const EMBER_FS = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float core = 1.0 - smoothstep(0.0, 1.0, d);
    float glow = core * core;
    float hot = pow(core, 6.0);
    vec3 col = mix(uCool, uHot, clamp(vHeat * 0.7 + hot, 0.0, 1.0)) + hot * 0.5;
    float a = glow * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * a, a);
  }
`;

const GLOW_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FS = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec2 vUv;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float n = noise(p * 5.0 + vec2(0.0, -uTime * 0.45)) * 0.6 + noise(p * 11.0 + vec2(uTime * 0.15, -uTime * 0.9)) * 0.4;
    float rr = r + (n - 0.5) * 0.16;
    float glow = pow(clamp(1.0 - rr, 0.0, 1.0), 2.4);
    float halo = exp(-pow((rr - 0.4) * 6.0, 2.0)) * 0.32;
    vec3 col = mix(uA, uB, smoothstep(0.7, 0.05, rr));
    float a = (glow + halo) * uIntensity * (0.78 + 0.22 * n);
    gl_FragColor = vec4(col * a, a);
  }
`;

async function initHero3D() {
  const stage = $('.stage');
  const layer = $('.stage__layer');
  const canvas = $('.stage__canvas');
  const fallback = $('.stage__pizza');
  if (!stage || !layer || !canvas || !fallback || REDUCED) return;
  if (!hasWebGL2()) return;

  let THREE;
  try {
    THREE = await import('three');
    performance.mark('forno:three');
  } catch (err) {
    return; // CDN unavailable → the static image stays.
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    return;
  }
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const CAM_Z = 10;
  camera.position.set(0, 0, CAM_Z);

  scene.environment = makeEnvironment(THREE, renderer);
  scene.environmentIntensity = 0.6;

  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x1c0b04, 0.55);
  const key = new THREE.DirectionalLight(0xffd6a6, 2.5);
  key.position.set(-4.5, 6.5, 6);
  const rim = new THREE.DirectionalLight(0xff6424, 0);
  rim.position.set(5, 3, -6);
  const fill = new THREE.DirectionalLight(0xe7b35a, 0.45);
  fill.position.set(4, -2, 5);
  scene.add(hemi, key, rim, fill);

  const rig = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.rotation.order = 'ZYX';
  const spin = new THREE.Group();
  rig.add(pivot);
  pivot.add(spin);
  scene.add(rig);
  const under = new THREE.PointLight(0xff5a1f, 0, 7, 2);
  under.position.set(0.3, -1.5, 1.4);
  rig.add(under);

  // --- Pizza top ---------------------------------------------------------
  const CRUST_H = 0.1;
  let img;
  try {
    const hiRes = !small && window.innerWidth >= 768 && (window.devicePixelRatio || 1) >= 1.5;
    img = await loadImage(`${ASSETS}${hiRes ? 'pizza-top-1600.webp' : 'pizza-top-800.webp'}`);
    performance.mark('forno:image');
  } catch (err) {
    renderer.dispose();
    return;
  }
  const maps = await analyzePizza(img, small ? 384 : 512, CRUST_H);
  performance.mark('forno:relief');
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const map = new THREE.Texture(img);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;
  map.needsUpdate = true;
  const dispTex = new THREE.CanvasTexture(maps.height);
  const normalTex = new THREE.CanvasTexture(maps.normal);
  normalTex.anisotropy = Math.min(8, maxAniso);
  const ormTex = new THREE.CanvasTexture(maps.orm);
  ormTex.anisotropy = Math.min(8, maxAniso);

  const topMat = new THREE.MeshPhysicalMaterial({
    map,
    alphaTest: 0.5,
    displacementMap: dispTex,
    displacementScale: CRUST_H,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: ormTex,
    roughness: 1,
    metalness: 0,
    clearcoat: 0.9,
    clearcoatMap: ormTex,
    clearcoatRoughness: 0.3,
    clearcoatNormalMap: normalTex,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xffd9ad),
  });
  topMat.alphaToCoverage = true;
  const top = new THREE.Mesh(makeDiscGeometry(THREE, small ? 96 : 140, small ? 200 : 320), topMat);
  top.frustumCulled = false;
  spin.add(top);

  const underTex = new THREE.CanvasTexture(makeUndersideCanvas());
  underTex.colorSpace = THREE.SRGBColorSpace;
  underTex.wrapS = THREE.RepeatWrapping;
  const underside = new THREE.Mesh(
    makeUnderside(THREE),
    new THREE.MeshStandardMaterial({ map: underTex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  );
  spin.add(underside);

  // --- Glow / heat haze behind the pizza ---------------------------------
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uA: { value: new THREE.Vector3(1.0, 0.33, 0.1) },
      uB: { value: new THREE.Vector3(0.95, 0.66, 0.3) },
    },
    vertexShader: GLOW_VS,
    fragmentShader: GLOW_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), glowMat);
  glow.position.z = -1.1;
  glow.renderOrder = -1;
  rig.add(glow);

  // --- Embers ------------------------------------------------------------
  const EMBERS = small ? 150 : 380;
  const eGeo = new THREE.BufferGeometry();
  const ePos = new Float32Array(EMBERS * 3);
  const eSeed = new Float32Array(EMBERS);
  const eSpeed = new Float32Array(EMBERS);
  const eScale = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    const gx = (Math.random() + Math.random() + Math.random()) / 3;
    ePos[i * 3] = gx * 2 - 1;
    ePos[i * 3 + 1] = Math.random();
    ePos[i * 3 + 2] = Math.random() * 2 - 1;
    eSeed[i] = Math.random();
    eSpeed[i] = 0.045 + Math.random() * 0.085;
    eScale[i] = Math.random() < 0.09 ? 2.4 + Math.random() * 2.2 : 0.55 + Math.random() * 0.9;
  }
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('aSeed', new THREE.BufferAttribute(eSeed, 1));
  eGeo.setAttribute('aSpeed', new THREE.BufferAttribute(eSpeed, 1));
  eGeo.setAttribute('aScale', new THREE.BufferAttribute(eScale, 1));
  const eMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uArea: { value: new THREE.Vector3(6, 3.2, 2.6) },
      uCenter: { value: new THREE.Vector3() },
      uPixelRatio: { value: DPR },
      uSize: { value: small ? 64 : 72 },
      uIntensity: { value: 0 },
      uHot: { value: new THREE.Vector3(1.0, 0.82, 0.52) },
      uCool: { value: new THREE.Vector3(1.0, 0.34, 0.1) },
    },
    vertexShader: EMBER_VS,
    fragmentShader: EMBER_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
  });
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false;
  scene.add(embers);

  // --- Floating ingredients ----------------------------------------------
  const ING = [
    ['basil-leaf', 310, 408],
    ['tomato-half', 315, 311],
    ['mozzarella-torn', 376, 366],
    ['chili', 367, 433],
    ['garlic', 265, 327],
    ['basil-sprig', 385, 366],
  ];
  const loader = new THREE.TextureLoader();
  const ingTex = await Promise.all(
    ING.map(([name]) =>
      loader
        .loadAsync(`${ASSETS}ing/${name}.webp`)
        .then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = Math.min(4, maxAniso);
          return t;
        })
        .catch(() => null)
    )
  );
  // type, angle(deg), radius, height (along normal), size, angular speed, phase
  const PLACE = [
    [0, 18, 1.26, 0.26, 0.24, 0.11],
    [1, 82, 1.34, -0.1, 0.26, 0.1],
    [2, 148, 1.22, 0.3, 0.28, 0.12],
    [3, 206, 1.4, 0.05, 0.34, 0.09],
    [4, 258, 1.24, 0.24, 0.21, 0.12],
    [5, 318, 1.34, -0.04, 0.3, 0.1],
    [1, 124, 1.6, 0.5, 0.19, 0.08],
    [0, 292, 1.64, -0.24, 0.18, 0.09],
    [3, 44, 1.68, -0.28, 0.22, 0.07],
    [2, 236, 1.72, 0.46, 0.22, 0.08],
  ].slice(0, small ? 7 : 10);
  const sprites = [];
  PLACE.forEach(([t, deg, r, h, size, w], i) => {
    const tex = ingTex[t];
    if (!tex) return;
    const [, iw, ih] = ING[t];
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.22,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry((size * iw) / ih, size), mat);
    mesh.renderOrder = 2;
    rig.add(mesh);
    sprites.push({
      mesh,
      a0: (deg * Math.PI) / 180,
      r,
      h,
      w: w * (i % 2 ? 1 : 0.85),
      phase: Math.random() * Math.PI * 2,
      rot0: Math.random() * Math.PI * 2,
      rs: (Math.random() - 0.5) * 0.5,
      delay: i * 0.06,
      fade: 1,
    });
  });

  // --- State & layout ------------------------------------------------------
  const state = { intro: 0, rim: 0, embers: 0, ing: 0, scroll: 0, scrollS: 0 };
  const base = { x: 0, y: 0, s: 1 };
  const aside = { x: 0, y: 0, s: 1 };
  let heroDrop = 0;
  let wide = true;
  let spinAngle = 0;
  let elapsed = 0;

  const textEls = $$('.hero__overline, .hero__title, .hero__sub, .hero__ctas, .hero__chips, .statement__over, .statement__text');
  let textRects = [];
  let viewW = 1;
  let viewH = 1;
  const measureText = () => {
    const sy = window.scrollY;
    textRects = textEls.map((el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - 28, r: r.right + 28, t: r.top + sy - 28, b: r.bottom + sy + 28 };
    });
  };
  const measure = () => {
    const W = Math.max(1, layer.clientWidth);
    const H = Math.max(1, layer.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const cx = fallback.offsetLeft + fallback.offsetWidth / 2;
    const cy = fallback.offsetTop + fallback.offsetHeight / 2;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const upp = (2 * halfH) / H;
    base.x = (cx - W / 2) * upp;
    base.y = -(cy - H / 2) * upp;
    base.s = (fallback.offsetWidth / 2) * upp;
    wide = window.matchMedia(MQ_WIDE).matches;
    if (wide) {
      aside.x = W * 0.1 * upp;
      aside.y = H * 0.02 * upp;
      aside.s = 1.06;
      heroDrop = 0;
    } else {
      aside.x = W * 0.22 * upp;
      aside.y = H * 0.04 * upp;
      aside.s = 0.95;
      heroDrop = -base.s * 0.1;
    }
    const halfW = halfH * camera.aspect;
    eMat.uniforms.uArea.value.set(halfW * 1.15, halfH * 1.18, 2.6);
    eMat.uniforms.uCenter.value.set(wide ? base.x * 0.45 : 0, 0, 0);
    viewW = W;
    viewH = H;
    measureText();
  };
  measure();
  if (HAS_GSAP) ScrollTrigger.addEventListener('refresh', measureText);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureText);
  window.addEventListener('load', measureText);

  // Pointer (damped)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (FINE) {
    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }

  // Scroll progress across the stage
  if (HAS_GSAP) {
    ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        state.scroll = self.progress;
      },
      onRefresh: (self) => {
        state.scroll = self.progress;
      },
    });
  } else {
    const onScroll = () => {
      const r = stage.getBoundingClientRect();
      state.scroll = clamp(-r.top / Math.max(1, r.height - layer.clientHeight), 0, 1);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Continue the CSS spin seamlessly.
  try {
    const m = new DOMMatrixReadOnly(getComputedStyle(fallback).transform);
    const deg = Math.atan2(m.b, m.a);
    fallback.style.transform = `rotate(${deg}rad)`;
    spinAngle = -deg;
  } catch (err) {
    spinAngle = 0;
  }

  const orbitEuler = new THREE.Euler(0, 0, 0, 'ZYX');
  const v3 = new THREE.Vector3();
  const wp = new THREE.Vector3();

  const frame = (dt) => {
    elapsed += dt;
    const kp = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * kp;
    pointer.y += (pointer.ty - pointer.y) * kp;
    if (!FINE) {
      pointer.tx = Math.sin(elapsed * 0.35) * 0.35;
      pointer.ty = Math.cos(elapsed * 0.27) * 0.25;
    }
    state.scrollS += (state.scroll - state.scrollS) * (1 - Math.exp(-dt * 7));
    const S = smoothstep(0.02, 0.82, state.scrollS);
    const I = state.intro;

    spinAngle -= dt * 0.12;
    spin.rotation.z = spinAngle - S * 1.3;

    const tilt = lerp(lerp(0, -0.98, I), -0.14, S);
    const roll = lerp(0, wide ? -0.17 : -0.1, I) * (1 - S * 0.6);
    pivot.rotation.set(tilt + pointer.y * 0.16 * I, pointer.x * 0.24 * I, roll);

    const s = base.s * lerp(1, aside.s, S) * (1 + 0.035 * I);
    rig.position.set(
      base.x + aside.x * S,
      base.y + heroDrop * I + aside.y * S + Math.sin(elapsed * 0.8) * 0.025 * I,
      0
    );
    rig.scale.setScalar(s);

    camera.position.set(pointer.x * 0.2 * I, -pointer.y * 0.14 * I, CAM_Z - S * 1.5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const layerTop = layer.getBoundingClientRect().top;
    const scrollY = window.scrollY;

    rim.intensity = 3.6 * state.rim;
    under.intensity = 6 * state.rim;
    key.intensity = 2.5 + 0.3 * S;
    glowMat.uniforms.uTime.value = elapsed;
    glowMat.uniforms.uIntensity.value = state.embers * (0.8 - S * 0.2);
    eMat.uniforms.uTime.value = elapsed;
    eMat.uniforms.uIntensity.value = state.embers;

    // Ingredients orbit in a plane tilted with the pizza; explode outward on scroll.
    orbitEuler.set(tilt * 0.9, 0, roll);
    const explode = S;
    sprites.forEach((sp) => {
      const local = clamp((state.ing - sp.delay) / (1 - sp.delay), 0, 1);
      const pop = local < 1 ? 1 - Math.pow(1 - local, 3) : 1;
      const ang = sp.a0 + elapsed * sp.w;
      const r = sp.r * lerp(0.6, 1, pop) * (1 + explode * 0.85);
      v3.set(
        Math.cos(ang) * r,
        Math.sin(ang) * r,
        sp.h * (1 + explode * 1.4) + Math.sin(elapsed * 0.9 + sp.phase) * 0.06
      );
      v3.applyEuler(orbitEuler);
      sp.mesh.position.copy(v3);
      sp.mesh.rotation.set(
        Math.sin(elapsed * 0.5 + sp.phase) * 0.45,
        Math.cos(elapsed * 0.42 + sp.phase) * 0.45,
        sp.rot0 + elapsed * sp.rs
      );
      sp.mesh.scale.setScalar(Math.max(0.0001, pop));
      const depth = clamp((v3.z + 1.3) / 2.2, 0, 1);
      const mobileFade = wide ? 1 : 1 - S * 0.55;
      // Fade sprites that drift over text so copy always stays legible.
      wp.copy(v3).multiplyScalar(rig.scale.x).add(rig.position).project(camera);
      const sx = (wp.x * 0.5 + 0.5) * viewW;
      const syv = (0.5 - wp.y * 0.5) * viewH + layerTop + scrollY;
      let overText = false;
      for (let k = 0; k < textRects.length; k++) {
        const tr = textRects[k];
        if (sx > tr.l && sx < tr.r && syv > tr.t && syv < tr.b) {
          overText = true;
          break;
        }
      }
      sp.fade += ((overText ? 0.1 : 1) - sp.fade) * (1 - Math.exp(-dt * 7));
      sp.mesh.material.opacity = lerp(0.42, 1, depth) * pop * mobileFade * sp.fade;
      sp.mesh.material.emissiveIntensity = lerp(0.08, 0.26, depth);
    });
  };

  // --- Upload & compile without blocking, then crossfade --------------------
  [map, dispTex, normalTex, ormTex, underTex, ...ingTex.filter(Boolean)].forEach((t) => renderer.initTexture(t));
  await nextFrame();
  try {
    if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
      await renderer.compileAsync(scene, camera);
    }
  } catch (err) {
    /* compile errors surface on first render */
  }

  let running = false;
  let rafId = 0;
  let lastT = 0;
  let visible = true;
  let started = false;
  const loop = (now) => {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    frame(dt);
    renderer.render(scene, camera);
  };
  const start = () => {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
  const update = () => (visible && !document.hidden && started ? start() : stop());

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        update();
      },
      { rootMargin: '80px 0px' }
    ).observe(stage);
  }
  document.addEventListener('visibilitychange', update);
  const onResize = debounce(measure, 120);
  window.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(layer);
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      stop();
      stage.classList.remove('is-3d');
      fallback.style.transform = '';
    },
    false
  );

  // First frame at the exact pose of the static image, then hand over.
  frame(0);
  renderer.render(scene, camera);
  await nextFrame();
  stage.classList.add('is-3d');
  performance.mark('forno:live');
  started = true;
  update();

  if (HAS_GSAP) {
    const tl = gsap.timeline();
    tl.to(state, { intro: 1, duration: 2.8, ease: 'expo.inOut' }, 0.2)
      .to(state, { rim: 1, duration: 2.4, ease: 'power2.inOut' }, 0.7)
      .to(state, { embers: 1, duration: 2.6, ease: 'power2.out' }, 0.35)
      .to(state, { ing: 1, duration: 2.2, ease: 'power2.out' }, 1.15);
  } else {
    const t0 = performance.now();
    const ramp = () => {
      const t = (performance.now() - t0) / 1000;
      const e = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      state.intro = e(clamp((t - 0.2) / 2.8, 0, 1));
      state.rim = e(clamp((t - 0.7) / 2.4, 0, 1));
      state.embers = clamp((t - 0.35) / 2.6, 0, 1);
      state.ing = clamp((t - 1.15) / 2.2, 0, 1);
      if (t < 4) requestAnimationFrame(ramp);
    };
    requestAnimationFrame(ramp);
  }
}

/* ==========================================================================
   Boot
   ========================================================================== */
function boot() {
  if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);
  safe('smooth scroll', initSmoothScroll);
  safe('anchors', initAnchors);
  safe('nav', initNav);
  safe('mobile menu', initMobileMenu);
  safe('hours', initHours);
  safe('menu', initMenu);
  safe('hero intro', initHeroIntro);
  safe('reveals', initReveals);
  safe('statement', initStatement);
  safe('story', initStory);
  safe('card', initCard3D);
  safe('reviews', initReviews);
  safe('buffet', initBuffet);
  safe('footer', initFooter);
  safe('cursor', initCursor);
  safe('magnetic', initMagnetic);
  root.classList.add('is-ready');

  initHero3D().catch((err) => console.warn('[forno] hero 3D:', err));

  if (HAS_GSAP) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
