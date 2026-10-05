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
   Il territorio: valley line + rally hairpins drawn with scroll
   -------------------------------------------------------------------------- */
function initTerritory() {
  const valley = $('.valley');
  const vLine = valley && $('.valley__line', valley);
  const pts = valley ? $$('.valley__pt', valley) : [];
  const road = $('.rally__trail');
  const place = (path, len, t, circles) => {
    const pt = path.getPointAtLength(len * clamp(t, 0, 1));
    circles.forEach((c) => {
      if (!c) return;
      c.setAttribute('cx', pt.x.toFixed(1));
      c.setAttribute('cy', pt.y.toFixed(1));
    });
  };
  // path fraction at which the line reaches each waypoint (x is monotonic along the valley)
  const tAtX = (path, len, x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(len * mid).x < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  if (!ANIM || !vLine) {
    pts.forEach((p) => p.classList.add('is-on'));
    return;
  }

  const draw = (path, trigger, circles, onT, start, end) => {
    const len = path.getTotalLength();
    const o = { t: 0 };
    const apply = () => {
      path.style.strokeDashoffset = String(1 - o.t);
      place(path, len, Math.max(0.0005, o.t), circles);
      if (onT) onT(o.t);
    };
    apply();
    gsap.to(o, {
      t: 1,
      ease: 'none',
      onUpdate: apply,
      scrollTrigger: { trigger, start, end, scrub: 0.8 },
    });
    return len;
  };

  const vLen = vLine.getTotalLength();
  pts.forEach((p) => {
    p.dataset.at = String(tAtX(vLine, vLen, parseFloat(p.dataset.x)));
  });
  draw(vLine, valley, [$('.valley__dot', valley), $('.valley__halo', valley)], (t) => {
    pts.forEach((p) => p.classList.toggle('is-on', t >= parseFloat(p.dataset.at) - 0.004));
  }, 'top 82%', 'bottom 42%');

  if (road) draw(road, '.rally', [$('.rally__car'), $('.rally__halo')], null, 'top 75%', 'bottom 35%');

  const img = $('.product__img');
  if (img) {
    gsap.fromTo(
      img,
      { y: 30 },
      { y: -40, ease: 'none', scrollTrigger: { trigger: '.terra__cards', start: 'top bottom', end: 'bottom top', scrub: true } }
    );
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
   HERO 3D — Three.js · "AL TAGLIO": a teglia cut in a 3x2 grid of slices
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

/* Separable box blur (3 passes ≈ gaussian) on a W×H Float32 field. */
function boxBlur(src, W, H, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / k;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}
const gaussBlur = (src, W, H, r) => boxBlur(boxBlur(boxBlur(src, W, H, r), W, H, r), W, H, r);

/* Teglia layout in texture pixels (teglia-top.webp is 1800×1200, see scripts/make_teglia.py). */
const TEX_W = 1800;
const TEX_H = 1200;
const T_MARGIN = 36; // 26px transparent margin + 10px inset: the photo is fully opaque inside
const T_RADIUS = 60; // 70px outline corner radius − inset
const CUT_XS = [26 + 1748 / 3, 26 + (2 * 1748) / 3];
const CUT_Y = 600;
const RIM_BAND = 84; // baked rim width (px) inside the inset outline
const UNIT = 3 / TEX_W; // world units per texture px: the whole photo spans 3 × 2 units

/** Distance (px) inside the inset rounded-rect outline; negative outside. */
function tegliaInside(tx, ty) {
  const hx = TEX_W / 2 - T_MARGIN - T_RADIUS;
  const hy = TEX_H / 2 - T_MARGIN - T_RADIUS;
  const qx = Math.abs(tx - TEX_W / 2) - hx;
  const qy = Math.abs(ty - TEX_H / 2) - hy;
  return -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - T_RADIUS);
}

/**
 * Relief from the teglia photo (luminance + colour classes):
 * - height field: raised baked rim (rounded profile from the outline) + melted cheese / basil bumps
 * - fine normal map from luminance detail; packed map R = oil (clearcoat), G = roughness
 * The float height field is returned so the slices are displaced on the CPU and the cut
 * walls can follow exactly the same profile (no gaps between top and crumb faces).
 */
async function analyzeTeglia(img, Wc) {
  const Hc = Math.round((Wc * TEX_H) / TEX_W);
  const sc = Wc / TEX_W;
  const R = (v) => Math.max(1, Math.round(v * sc));
  const cv = document.createElement('canvas');
  cv.width = Wc;
  cv.height = Hc;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, Wc, Hc);
  const src = ctx.getImageData(0, 0, Wc, Hc).data;
  const N = Wc * Hc;
  const L = new Float32Array(N);
  const CH = new Float32Array(N);
  const BA = new Float32Array(N);
  const SA = new Float32Array(N);
  const DARK = new Float32Array(N);
  const DIN = new Float32Array(N);
  for (let y = 0, i = 0; y < Hc; y++) {
    for (let x = 0; x < Wc; x++, i++) {
      const p = i * 4;
      const r = src[p] / 255;
      const g = src[p + 1] / 255;
      const b = src[p + 2] / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const sat = mx > 1e-4 ? (mx - mn) / mx : 0;
      L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      SA[i] = smoothstep(0.48, 0.6, (r - Math.max(g, b)) / Math.max(r, 1e-3)) * smoothstep(0.2, 0.35, mx);
      BA[i] = smoothstep(0.04, 0.18, (g - r) / Math.max(g, 1e-3));
      CH[i] = smoothstep(0.62, 0.8, mx) * (1 - smoothstep(0.2, 0.45, sat));
      DARK[i] = 1 - smoothstep(0.12, 0.38, mx);
      DIN[i] = tegliaInside((x + 0.5) / sc, (y + 0.5) / sc);
    }
  }
  await nextFrame();

  const chB = gaussBlur(CH, Wc, Hc, R(3));
  const baB = gaussBlur(BA, Wc, Hc, R(2));
  await nextFrame();
  const Lb = gaussBlur(L, Wc, Hc, R(4));
  const Lf = gaussBlur(L, Wc, Hc, 1);
  await nextFrame();

  let H = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = DIN[i];
    if (d <= 0) continue;
    const rim = d < RIM_BAND ? Math.pow(Math.sin((Math.PI * d) / RIM_BAND), 0.7) : 0;
    const inner = smoothstep(52, 96, d);
    H[i] = rim * (1 + (L[i] - Lb[i]) * 0.8) + inner * (chB[i] * 0.34 + baB[i] * 0.16);
  }
  H = gaussBlur(H, Wc, Hc, R(2));
  let maxH = 1e-4;
  for (let i = 0; i < N; i++) {
    H[i] *= smoothstep(0, 6, DIN[i]); // the outline stays exactly at the base height
    if (H[i] > maxH) maxH = H[i];
  }
  for (let i = 0; i < N; i++) H[i] /= maxH;
  await nextFrame();

  const normalCv = document.createElement('canvas');
  const ormCv = document.createElement('canvas');
  normalCv.width = ormCv.width = Wc;
  normalCv.height = ormCv.height = Hc;
  const nImg = normalCv.getContext('2d').createImageData(Wc, Hc);
  const oImg = ormCv.getContext('2d').createImageData(Wc, Hc);
  const px = 3 / Wc; // world size of one analysis pixel
  const fine = new Float32Array(N);
  for (let i = 0; i < N; i++) fine[i] = (L[i] - Lf[i]) * 0.0035;
  for (let y = 0; y < Hc; y++) {
    for (let x = 0; x < Wc; x++) {
      const i = y * Wc + x;
      const dhdx = (fine[y * Wc + Math.min(Wc - 1, x + 1)] - fine[y * Wc + Math.max(0, x - 1)]) / (2 * px);
      const dhdy = -(fine[Math.min(Hc - 1, y + 1) * Wc + x] - fine[Math.max(0, y - 1) * Wc + x]) / (2 * px);
      const inv = 1 / Math.sqrt(dhdx * dhdx + dhdy * dhdy + 1);
      const p = i * 4;
      nImg.data[p] = (-dhdx * inv * 0.5 + 0.5) * 255;
      nImg.data[p + 1] = (-dhdy * inv * 0.5 + 0.5) * 255;
      nImg.data[p + 2] = (inv * 0.5 + 0.5) * 255;
      nImg.data[p + 3] = 255;
      const inner = smoothstep(56, 96, DIN[i]);
      oImg.data[p] = clamp((SA[i] * 0.9 + CH[i] * 0.75 + BA[i] * 0.45) * inner, 0, 1) * 255;
      oImg.data[p + 1] = clamp(0.46 - 0.08 * CH[i] - 0.05 * SA[i] + (1 - inner) * 0.36 + DARK[i] * 0.1, 0.28, 0.95) * 255;
      oImg.data[p + 2] = 0;
      oImg.data[p + 3] = 255;
    }
  }
  normalCv.getContext('2d').putImageData(nImg, 0, 0);
  ormCv.getContext('2d').putImageData(oImg, 0, 0);
  return { height: H, w: Wc, h: Hc, normal: normalCv, orm: ormCv };
}

/** Bilinear sample of a W×H field at texture uv (v = 0 at the bottom). */
function sampleField(F, W, H, u, v) {
  const x = clamp(u * W - 0.5, 0, W - 1.001);
  const y = clamp((1 - v) * H - 0.5, 0, H - 1.001);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * W + x0;
  return (F[i] * (1 - fx) + F[i + 1] * fx) * (1 - fy) + (F[i + W] * (1 - fx) + F[i + W + 1] * fx) * fy;
}

/** Alpha mask for the top faces: trims the rounded teglia corners (slightly dilated). */
function makeTegliaMask(Wm = 600) {
  const Hm = Math.round((Wm * TEX_H) / TEX_W);
  const s = Wm / TEX_W;
  const c = document.createElement('canvas');
  c.width = Wm;
  c.height = Hm;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, Wm, Hm);
  g.fillStyle = '#fff';
  const m = (T_MARGIN - 3) * s;
  const r = (T_RADIUS + 3) * s;
  const w = Wm - 2 * m;
  const h = Hm - 2 * m;
  g.beginPath();
  g.moveTo(m + r, m);
  g.arcTo(m + w, m, m + w, m + h, r);
  g.arcTo(m + w, m + h, m, m + h, r);
  g.arcTo(m, m + h, m, m, r);
  g.arcTo(m, m, m + w, m, r);
  g.closePath();
  g.fill();
  return c;
}

/** Top face of one slice: dense grid, displaced on the CPU, uv = sub-rect of the photo. */
function buildSliceTop(THREE, b, T, relief, seg) {
  const n = seg + 1;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  let k = 0;
  for (let j = 0; j <= seg; j++) {
    const y = b.y0 + ((b.y1 - b.y0) * j) / seg;
    for (let i = 0; i <= seg; i++) {
      const x = b.x0 + ((b.x1 - b.x0) * i) / seg;
      const u = x / 3 + 0.5;
      const v = y / 2 + 0.5;
      pos[k * 3] = x - b.cx;
      pos[k * 3 + 1] = y - b.cy;
      pos[k * 3 + 2] = T + relief(u, v);
      uv[k * 2] = u;
      uv[k * 2 + 1] = v;
      k++;
    }
  }
  const idx = [];
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * n + i;
      idx.push(a, a + 1, a + n + 1, a, a + n + 1, a + n);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Walls + bottom of one slice. Cut faces show the airy crumb (full crumb texture),
 * outer walls and the bottom use its toasted golden base band.
 */
function buildSliceBody(THREE, b, T, relief, seg, corner, outer, crumbRepeat, uOffset) {
  const R = T_RADIUS * UNIT;
  const P = [];
  const NRM = [];
  const UV = [];
  const COL = [];
  const IDX = [];
  const poly = [];
  let s = uOffset;
  const inner = [1, 1, 1];
  const toast = [0.9, 0.8, 0.7];
  const base = [0.62, 0.5, 0.4];

  const quad = (ax, ay, bx, by, nax, nay, nbx, nby, isOuter) => {
    const za = T + relief(ax / 3 + 0.5, ay / 2 + 0.5);
    const zb = T + relief(bx / 3 + 0.5, by / 2 + 0.5);
    const len = Math.hypot(bx - ax, by - ay);
    const vb = isOuter ? 0.01 : 0;
    const vt = isOuter ? 0.14 : 1;
    // keep the photo's proportions: outer walls only use the golden base band, scaled up evenly
    const rep = crumbRepeat / (vt - vb);
    const u0 = s / rep;
    const u1 = (s + len) / rep;
    s += len;
    const col = isOuter ? toast : inner;
    const i0 = P.length / 3;
    P.push(ax - b.cx, ay - b.cy, 0, bx - b.cx, by - b.cy, 0, bx - b.cx, by - b.cy, zb, ax - b.cx, ay - b.cy, za);
    NRM.push(nax, nay, 0, nbx, nby, 0, nbx, nby, 0, nax, nay, 0);
    UV.push(u0, vb, u1, vb, u1, vt, u0, vt);
    for (let q = 0; q < 4; q++) COL.push(...col);
    IDX.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    poly.push([ax, ay]);
  };
  const edge = (ax, ay, bx, by, nx, ny, isOuter) => {
    const pieces = isOuter ? Math.max(2, Math.round(seg / 4)) : seg;
    for (let q = 0; q < pieces; q++) {
      const t0 = q / pieces;
      const t1 = (q + 1) / pieces;
      quad(lerp(ax, bx, t0), lerp(ay, by, t0), lerp(ax, bx, t1), lerp(ay, by, t1), nx, ny, nx, ny, isOuter);
    }
  };
  const arc = (xc, yc, a0, a1) => {
    const pieces = 10;
    for (let q = 0; q < pieces; q++) {
      const t0 = lerp(a0, a1, q / pieces);
      const t1 = lerp(a0, a1, (q + 1) / pieces);
      quad(xc + R * Math.cos(t0), yc + R * Math.sin(t0), xc + R * Math.cos(t1), yc + R * Math.sin(t1),
        Math.cos(t0), Math.sin(t0), Math.cos(t1), Math.sin(t1), true);
    }
  };

  const rBL = corner === 'bl' ? R : 0;
  const rBR = corner === 'br' ? R : 0;
  const rTR = corner === 'tr' ? R : 0;
  const rTL = corner === 'tl' ? R : 0;
  edge(b.x0 + rBL, b.y0, b.x1 - rBR, b.y0, 0, -1, outer.b);
  if (rBR) arc(b.x1 - R, b.y0 + R, -Math.PI / 2, 0);
  edge(b.x1, b.y0 + rBR, b.x1, b.y1 - rTR, 1, 0, outer.r);
  if (rTR) arc(b.x1 - R, b.y1 - R, 0, Math.PI / 2);
  edge(b.x1 - rTR, b.y1, b.x0 + rTL, b.y1, 0, 1, outer.t);
  if (rTL) arc(b.x0 + R, b.y1 - R, Math.PI / 2, Math.PI);
  edge(b.x0, b.y1 - rTL, b.x0, b.y0 + rBL, -1, 0, outer.l);
  if (rBL) arc(b.x0 + R, b.y0 + R, Math.PI, Math.PI * 1.5);

  // Bottom: fan from the centre (the footprint is convex), facing −z.
  const c0 = P.length / 3;
  const bh = b.y1 - b.y0;
  P.push(0, 0, 0);
  NRM.push(0, 0, -1);
  UV.push(0.5 + b.cx * 0.04, 0.05);
  COL.push(...base);
  poly.forEach(([x, y]) => {
    P.push(x - b.cx, y - b.cy, 0);
    NRM.push(0, 0, -1);
    UV.push(0.5 + x * 0.04, 0.03 + 0.04 * ((y - b.y0) / bh));
    COL.push(...base);
  });
  for (let q = 0; q < poly.length; q++) {
    const a = c0 + 1 + q;
    const nxt = c0 + 1 + ((q + 1) % poly.length);
    IDX.push(c0, nxt, a);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(NRM, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  geo.setIndex(IDX);
  return geo;
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
  renderer.toneMappingExposure = 1.05;

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
  const slab = new THREE.Group();
  rig.add(pivot);
  pivot.add(slab);
  scene.add(rig);
  const under = new THREE.PointLight(0xff5a1f, 0, 7, 2);
  under.position.set(0.3, -1.3, 1.3);
  rig.add(under);

  // --- Teglia textures ------------------------------------------------------
  const T = 0.165; // slab thickness ≈ 5.6% of the width: reads as airy
  const CRUST = 0.045; // height of the baked rim above the base
  const picked = fallback.currentSrc || '';
  const hiRes = !small && window.innerWidth >= 768 && (window.devicePixelRatio || 1) >= 1.5;
  const topSrc = /teglia-top(-900)?\.webp/.test(picked) ? picked : `${ASSETS}${hiRes ? 'teglia-top.webp' : 'teglia-top-900.webp'}`;
  let img;
  try {
    img = await loadImage(topSrc);
    performance.mark('forno:image');
  } catch (err) {
    renderer.dispose();
    return;
  }
  const loader = new THREE.TextureLoader();
  const crumbPromise = loader.loadAsync(`${ASSETS}crumb-side.webp`).catch(() => null);
  const maps = await analyzeTeglia(img, small ? 600 : 900);
  performance.mark('forno:relief');
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const map = new THREE.Texture(img);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;
  map.needsUpdate = true;
  const alphaTex = new THREE.CanvasTexture(makeTegliaMask());
  const normalTex = new THREE.CanvasTexture(maps.normal);
  normalTex.anisotropy = Math.min(8, maxAniso);
  const ormTex = new THREE.CanvasTexture(maps.orm);
  ormTex.anisotropy = Math.min(8, maxAniso);
  const crumbTex = await crumbPromise;
  if (crumbTex) {
    crumbTex.colorSpace = THREE.SRGBColorSpace;
    crumbTex.wrapS = THREE.RepeatWrapping;
    crumbTex.anisotropy = Math.min(8, maxAniso);
  }

  const topMat = new THREE.MeshPhysicalMaterial({
    map,
    alphaMap: alphaTex,
    alphaTest: 0.5,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: ormTex,
    roughness: 1,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatMap: ormTex,
    clearcoatRoughness: 0.32,
    clearcoatNormalMap: normalTex,
    sheen: 0.2,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xffd9ad),
  });
  topMat.alphaToCoverage = true;
  const bodyMat = new THREE.MeshStandardMaterial({
    map: crumbTex,
    color: crumbTex ? 0xffffff : 0xc98f52,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0,
  });

  // --- The six slices (3 columns × 2 rows) ---------------------------------------
  const relief = (u, v) => CRUST * sampleField(maps.height, maps.w, maps.h, u, v);
  const crumbRepeat = (T * 2048) / 300; // keep the crumb photo's proportions on the walls
  const seg = small ? 30 : 46;
  const xs = [(T_MARGIN - TEX_W / 2) * UNIT, (CUT_XS[0] - TEX_W / 2) * UNIT, (CUT_XS[1] - TEX_W / 2) * UNIT, (TEX_W / 2 - T_MARGIN) * UNIT];
  const ys = [(TEX_H / 2 - T_MARGIN) * UNIT, (TEX_H / 2 - CUT_Y) * UNIT, (T_MARGIN - TEX_H / 2) * UNIT];
  const slices = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const b = { x0: xs[c], x1: xs[c + 1], y0: ys[r + 1], y1: ys[r] };
      b.cx = (b.x0 + b.x1) / 2;
      b.cy = (b.y0 + b.y1) / 2;
      const corner = c === 1 ? null : `${r === 0 ? 't' : 'b'}${c === 0 ? 'l' : 'r'}`;
      const outer = { l: c === 0, r: c === 2, t: r === 0, b: r === 1 };
      const group = new THREE.Group();
      group.position.set(b.cx, b.cy, 0);
      group.add(
        new THREE.Mesh(buildSliceTop(THREE, b, T, relief, seg), topMat),
        new THREE.Mesh(buildSliceBody(THREE, b, T, relief, seg, corner, outer, crumbRepeat, Math.random() * 3), bodyMat)
      );
      slab.add(group);
      slices.push({
        group,
        cx: b.cx,
        cy: b.cy,
        sx: c - 1,
        sy: r === 0 ? 1 : -1,
        lift: 0.15 + Math.random() * 0.1 + (c === 1 ? 0.07 : 0),
        twist: (Math.random() - 0.5) * 0.14,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  slab.position.z = -T / 2;

  // --- Glow / heat haze behind the teglia -----------------------------------------
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
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 4.9), glowMat);
  glow.position.z = -1.0;
  glow.renderOrder = -1;
  rig.add(glow);

  // --- Embers ------------------------------------------------------------------
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

  // --- Floating ingredients (elliptical orbit around the teglia) -------------------
  const ING = [
    ['basil-leaf', 310, 408],
    ['tomato-half', 315, 311],
    ['mozzarella-torn', 376, 366],
    ['chili', 367, 433],
    ['garlic', 265, 327],
    ['basil-sprig', 385, 366],
  ];
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
  // type, angle(deg), radius, height (along the normal), size, angular speed
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

  // --- State & layout ------------------------------------------------------------
  const state = { intro: 0, rim: 0, embers: 0, ing: 0, cut: 0, scroll: 0, scrollS: 0 };
  const base = { x: 0, y: 0, s: 1 };
  const aside = { x: 0, y: 0, s: 1 };
  let heroDrop = 0;
  let wide = true;
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
    // The face-on teglia matches the static image box exactly (the photo spans 3 world units).
    const cx = fallback.offsetLeft + fallback.offsetWidth / 2;
    const cy = fallback.offsetTop + fallback.offsetHeight / 2;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    const upp = (2 * halfH) / H;
    base.x = (cx - W / 2) * upp;
    base.y = -(cy - H / 2) * upp;
    base.s = (fallback.offsetWidth * upp) / 3;
    wide = window.matchMedia(MQ_WIDE).matches;
    if (wide) {
      aside.x = -W * 0.02 * upp;
      aside.y = H * 0.02 * upp;
      aside.s = 0.76;
      heroDrop = 0;
    } else {
      // narrow: the teglia travels down and ends below the statement text
      aside.x = 0;
      aside.y = -H * 0.4 * upp;
      aside.s = 0.86;
      heroDrop = -base.s * 0.16;
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

  const orbitEuler = new THREE.Euler(0, 0, 0, 'ZYX');
  const v3 = new THREE.Vector3();
  const wp = new THREE.Vector3();

  const frame = (dt) => {
    elapsed += dt;
    const kp = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * kp;
    pointer.y += (pointer.ty - pointer.y) * kp;
    if (!FINE) {
      pointer.tx = Math.sin(elapsed * 0.35) * 0.3;
      pointer.ty = Math.cos(elapsed * 0.27) * 0.2;
    }
    state.scrollS += (state.scroll - state.scrollS) * (1 - Math.exp(-dt * 7));
    const S = smoothstep(0.02, 0.8, state.scrollS);
    const I = state.intro;

    // Hero pose → exploded pose (turns, tilts toward the viewer, moves aside)
    const tilt = lerp(lerp(0, -0.95, I), -0.6, S);
    const yaw = lerp(lerp(0, wide ? 0.32 : 0.16, I), wide ? -0.24 : -0.12, S) + Math.sin(elapsed * 0.35) * 0.05 * I;
    const roll = lerp(lerp(0, wide ? -0.09 : -0.06, I), 0.05, S);
    pivot.rotation.set(tilt + pointer.y * 0.15 * I, yaw + pointer.x * 0.26 * I, roll);

    // AL TAGLIO: slices part, lift and turn so the airy crumb on the cut faces shows.
    const E = Math.max(smoothstep(0.04, 0.7, state.scrollS), state.cut * 0.2);
    const gap = 0.004 * I;
    slices.forEach((sl) => {
      sl.group.position.set(
        sl.cx + sl.sx * (gap + 0.2 * E),
        sl.cy + sl.sy * (gap + 0.27 * E),
        E * sl.lift + Math.sin(elapsed * 1.2 + sl.phase) * 0.014 * E
      );
      sl.group.rotation.set(-sl.sy * 0.24 * E, sl.sx * 0.26 * E, sl.twist * E);
    });

    const s = base.s * lerp(1, aside.s, S) * (1 + 0.035 * I);
    rig.position.set(
      base.x + aside.x * S,
      base.y + heroDrop * I * (1 - S) + aside.y * S + Math.sin(elapsed * 0.8) * 0.025 * I,
      0
    );
    rig.scale.setScalar(s);

    camera.position.set(pointer.x * 0.2 * I, -pointer.y * 0.14 * I, CAM_Z - S * 1.0);
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

    // Ingredients orbit in a plane tilted with the teglia; they drift outward on scroll.
    orbitEuler.set(tilt * 0.9, yaw * 0.8, roll);
    sprites.forEach((sp) => {
      const local = clamp((state.ing - sp.delay) / (1 - sp.delay), 0, 1);
      const pop = local < 1 ? 1 - Math.pow(1 - local, 3) : 1;
      const ang = sp.a0 + elapsed * sp.w;
      const r = sp.r * lerp(0.6, 1, pop) * (1 + S * 0.6);
      v3.set(
        Math.cos(ang) * r * 1.42,
        Math.sin(ang) * r,
        sp.h * (1 + S * 1.4) + Math.sin(elapsed * 0.9 + sp.phase) * 0.06
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

  // --- Upload & compile without blocking, then crossfade ----------------------------
  [map, alphaTex, normalTex, ormTex, crumbTex, ...ingTex].filter(Boolean).forEach((t) => renderer.initTexture(t));
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
      .to(state, { cut: 1, duration: 0.9, ease: 'power3.out' }, 1.9)
      .to(state, { cut: 0, duration: 1.3, ease: 'power3.inOut' }, 2.8)
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
      state.cut = Math.sin(Math.PI * clamp((t - 1.9) / 2.2, 0, 1));
      if (t < 4.5) requestAnimationFrame(ramp);
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
  safe('territory', initTerritory);
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
