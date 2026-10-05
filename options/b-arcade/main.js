/* =====================================================================
   PIZZA VOGLIA — Opzione B "SALA GIOCHI" · logica della pagina
   (il mini-gioco vive in game.js)
   ===================================================================== */
import { mountGame, Sfx, pizzaIcon, spriteCanvas } from './game.js';

/* ---------------------------------------------------------------------
   Orari (Europe/Rome) — funzioni pure, testabili
   --------------------------------------------------------------------- */
const LUNCH = [11 * 60, 13 * 60 + 30];
const DINNER = [17 * 60 + 30, 20 * 60 + 30];
const WEEKEND = [17 * 60, 20 * 60 + 30];
export const HOURS = {
  0: [WEEKEND],
  1: [LUNCH, DINNER],
  2: [LUNCH, DINNER],
  3: [LUNCH, DINNER],
  4: [LUNCH, DINNER],
  5: [LUNCH, DINNER],
  6: [WEEKEND],
};
const DAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Giorno della settimana (0 = domenica) e minuti dalla mezzanotte, ora di Roma. */
export function romeNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  const day = WEEKDAYS[get('weekday')];
  const h = Number(get('hour')) % 24;
  const m = Number(get('minute'));
  return { day, min: h * 60 + m };
}

/** Stato di apertura dato giorno e minuti. */
export function openStatus(day, min) {
  for (const [a, b] of HOURS[day] || []) {
    if (min >= a && min < b) return { open: true, closes: b, soon: b - min <= 30 };
  }
  for (let add = 0; add <= 7; add++) {
    const d = (day + add) % 7;
    for (const [a] of HOURS[d] || []) {
      if (add === 0 && a <= min) continue;
      return { open: false, day: d, opens: a, add };
    }
  }
  return { open: false, day: null, opens: null, add: null };
}

export function statusLabel(st) {
  if (st.open) return { state: 'open', head: 'Aperto ora', tail: `chiude alle ${hhmm(st.closes)}${st.soon ? ' — corri!' : ''}` };
  if (st.opens == null) return { state: 'closed', head: 'Chiuso', tail: '' };
  const when = st.add === 0 ? 'oggi' : st.add === 1 ? 'domani' : DAY_NAMES[st.day];
  return { state: 'closed', head: 'Chiuso', tail: `riapre ${when} alle ${hhmm(st.opens)}` };
}

/* ---------------------------------------------------------------------
   Icone pixel delle pizze (menu "seleziona il personaggio")
   --------------------------------------------------------------------- */
const PIZZAS = {
  't-margherita': { shape: 'slice', base: 'sauce', top: [['mozz', 4], ['basil', 3]] },
  't-rossa': { shape: 'slice', base: 'sauce', top: [['oregano', 14], ['garlic', 3]] },
  't-patate': { shape: 'slice', base: 'white', top: [['potato', 7], ['rosemary', 5]] },
  't-verdure': { shape: 'slice', base: 'sauce', top: [['zucchini', 3], ['pepper', 3], ['eggplant', 2], ['pepperR', 2]] },
  't-salame': { shape: 'slice', base: 'sauce', top: [['mozz', 3], ['salame', 4], ['flake', 5]] },
  marinara: { shape: 'round', base: 'sauce', top: [['garlic', 7], ['oregano', 12]] },
  margherita: { shape: 'round', base: 'sauce', top: [['mozz', 5], ['basil', 3]] },
  diavola: { shape: 'round', base: 'sauce', top: [['mozz', 3], ['salame', 6]] },
  capricciosa: { shape: 'round', base: 'sauce', top: [['ham', 3], ['mushroom', 3], ['artichoke', 2], ['olive', 3], ['mozz', 2]] },
  '4formaggi': { shape: 'round', base: 'cheese', top: [['mozz', 4], ['gorgonzola', 3], ['shaving', 5]] },
  prosciuttofunghi: { shape: 'round', base: 'sauce', top: [['mozz', 3], ['ham', 4], ['mushroom', 4]] },
  bufala: { shape: 'round', base: 'sauce', top: [['bufala', 4], ['basil', 2]] },
  ortolana: { shape: 'round', base: 'sauce', top: [['mozz', 2], ['zucchini', 3], ['pepper', 3], ['eggplant', 2]] },
  valpantena: { shape: 'slice', base: 'white', top: [['broccoli', 5], ['tarallo', 3], ['shaving', 5]] },
  calzone: { shape: 'calzone' },
  focaccia: { shape: 'focaccia', top: [['rosemary', 6], ['salt', 6]] },
  buffet: { shape: 'tray' },
};

/* ---------------------------------------------------------------------
   Avvio pagina
   --------------------------------------------------------------------- */
if (typeof document !== 'undefined') boot();

function boot() {
  const doc = document;
  const root = doc.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const sfx = new Sfx();
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const cc = (w, h) => {
    const c = doc.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const safe = (name, fn) => {
    try {
      fn();
    } catch (err) {
      console.warn(`[sala-giochi] ${name}:`, err);
    }
  };
  /** Esegue cb(true/false) quando l'elemento entra/esce dal viewport. */
  const watch = (el, cb, opts = {}) => {
    if (!el) return;
    if (!hasIO) {
      cb(true);
      return;
    }
    new IntersectionObserver((entries) => entries.forEach((en) => cb(en.isIntersecting, en)), opts).observe(el);
  };

  root.classList.add('has-js');

  safe('nav', initNav);
  safe('game', initGame);
  safe('icons', initIcons);
  safe('menu', initMenu);
  safe('led', initLed);
  safe('ambient', initAmbient);
  safe('reveal', initReveal);
  safe('powerup', initPowerup);
  safe('hours', initHours);
  safe('continue', initContinue);
  safe('year', () => {
    const y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
  });

  /* ---------------- navigazione ---------------- */
  function initNav() {
    const toggle = $('.nav-toggle');
    const nav = $('#site-nav');
    if (!toggle || !nav) return;
    const desktop = window.matchMedia('(min-width: 960px)');
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open, focusToggle = false) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Chiudi il menu di navigazione' : 'Apri il menu di navigazione');
      nav.classList.toggle('is-open', open);
      root.classList.toggle('nav-open', open);
      if (open) {
        const first = $('.nav-list a', nav);
        if (first) first.focus({ preventScroll: true });
      } else if (focusToggle) toggle.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => setOpen(!isOpen()));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    doc.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false, true);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [toggle, ...$$('a, button', nav)].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    const onChange = () => {
      if (desktop.matches && isOpen()) setOpen(false);
    };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);

    // voce attiva in base alla sezione visibile
    const links = $$('.nav-list a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    if (hasIO) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            links.forEach((a) => a.removeAttribute('aria-current'));
            const a = byId.get(en.target.id);
            if (a) a.setAttribute('aria-current', 'true');
          });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      byId.forEach((_, id) => {
        const sec = doc.getElementById(id);
        if (sec) io.observe(sec);
      });
    }
  }

  /* ---------------- gioco + audio ---------------- */
  function initGame() {
    const cabinet = $('#cabinet');
    const canvas = $('#game');
    const screen = $('#screen');
    const soundBtn = $('#btn-sound');
    if (soundBtn) {
      if (!sfx.supported) soundBtn.hidden = true;
      soundBtn.addEventListener('click', () => {
        if (sfx.on) sfx.disable();
        else if (sfx.enable()) sfx.play('select');
        soundBtn.setAttribute('aria-pressed', String(sfx.on));
        const label = $('.sound-label', soundBtn);
        if (label) label.textContent = sfx.on ? 'Audio on' : 'Audio off';
      });
    }
    if (!cabinet || !canvas || !screen || !canvas.getContext) return;
    mountGame(
      {
        cabinet,
        screen,
        canvas,
        start: $('#btn-start'),
        left: $('#btn-left'),
        right: $('#btn-right'),
        over: $('#game-over'),
        replay: $('#replay'),
        live: $('#game-live'),
      },
      { sfx, reducedMotion: reduced }
    );
    cabinet.classList.add('is-ready');
  }

  /* ---------------- icone pixel ---------------- */
  function paint(target, src, box) {
    target.width = src.width;
    target.height = src.height;
    const g = target.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    if (box) {
      const s = Math.max(1, Math.floor(box / Math.max(src.width, src.height)));
      target.style.width = `${src.width * s}px`;
      target.style.height = `${src.height * s}px`;
    }
  }
  function initIcons() {
    $$('canvas[data-pizza]').forEach((cv) => {
      const key = cv.dataset.pizza;
      if (PIZZAS[key]) paint(cv, pizzaIcon({ id: key, ...PIZZAS[key] }, cc));
    });
    $$('canvas[data-icon]').forEach((cv) => {
      const src = spriteCanvas(cv.dataset.icon, cc);
      if (src) paint(cv, src, Number(cv.dataset.fit) || 0);
    });
  }

  /* ---------------- menu: tab + selezione ---------------- */
  function initMenu() {
    const tablist = $('.tabs');
    if (!tablist) return;
    const tabs = $$('[role="tab"]', tablist);
    const panels = tabs.map((t) => doc.getElementById(t.getAttribute('aria-controls')));
    if (!tabs.length || panels.some((p) => !p)) return;
    let unlocked = false;

    panels.forEach((p, i) => {
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', tabs[i].id);
      p.tabIndex = 0;
      $$('.fighter', p).forEach((f, j) => f.style.setProperty('--i', String(j)));
    });

    const unlock = (panel, tab) => {
      unlocked = true;
      tab.classList.add('is-unlocked');
      const secret = $('.secret', panel);
      if (!secret) return;
      if (reduced) {
        secret.classList.add('is-unlocked');
        return;
      }
      secret.classList.add('is-unlocking');
      sfx.play('power');
      window.setTimeout(() => {
        secret.classList.remove('is-unlocking');
        secret.classList.add('is-unlocked');
      }, 900);
    };

    const select = (i, focus) => {
      tabs.forEach((t, j) => {
        const on = j === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      const panel = panels[i];
      if (!reduced) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
      if (tabs[i].hasAttribute('data-secret') && !unlocked) unlock(panel, tabs[i]);
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => {
        select(i, false);
        sfx.play('select');
      });
      t.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        select(n, true);
      });
    });
    tablist.hidden = false;
    root.classList.add('has-tabs');
    select(0, false);

    // "Giocatore 1": scelta della pizza
    const bar = $('#select-bar');
    const nameEl = bar && $('[data-selected]', bar);
    const picks = $$('.pick');
    picks.forEach((btn) => {
      btn.addEventListener('click', () => {
        const wasOn = btn.getAttribute('aria-pressed') === 'true';
        picks.forEach((b) => {
          b.setAttribute('aria-pressed', 'false');
          const card = b.closest('.card, .secret');
          if (card) card.classList.remove('is-picked');
          const l = $('.pick-label', b);
          if (l) l.textContent = 'Scegli';
        });
        if (!wasOn) {
          btn.setAttribute('aria-pressed', 'true');
          const card = btn.closest('.card, .secret');
          if (card) card.classList.add('is-picked');
          const l = $('.pick-label', btn);
          if (l) l.textContent = 'Scelta!';
          if (nameEl) nameEl.textContent = btn.dataset.name || '';
          if (bar) bar.classList.add('is-ready');
          sfx.play('select');
        } else {
          if (nameEl) nameEl.textContent = 'scegli una pizza';
          if (bar) bar.classList.remove('is-ready');
        }
      });
    });
  }

  /* ---------------- insegna LED: scorrimento a scatti di 3px ---------------- */
  function initLed() {
    const led = $('.led');
    if (!led || reduced) return;
    const copy = $('.led-copy', led);
    const measure = () => {
      const w = copy.getBoundingClientRect().width;
      if (!w) return;
      led.style.setProperty('--led-steps', String(Math.max(1, Math.round(w / 3))));
      led.style.setProperty('--led-dur', `${(w / 60).toFixed(2)}s`);
    };
    measure();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure).catch(() => {});
    watch(led, (on) => led.classList.toggle('is-paused', !on));
  }

  /* ---------------- animazioni decorative in pausa fuori schermo ---------------- */
  function initAmbient() {
    $$('.hero, .boss, .multi').forEach((sec) => watch(sec, (on) => sec.classList.toggle('is-off', !on)));
  }

  /* ---------------- comparsa a scatti ---------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!els.length || reduced || !hasIO) return;
    root.classList.add('has-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------------- power-up: la foto si "de-pixela" ---------------- */
  function initPowerup() {
    const box = $('.powerup-img');
    if (!box) return;
    const img = $('img', box);
    const cv = $('canvas', box);
    if (!img || !cv) return;
    if (reduced || !hasIO || !cv.getContext) {
      cv.remove();
      return;
    }
    const steps = [56, 40, 28, 18, 12, 8, 5, 3];
    let ready = false;
    let visible = false;
    let played = false;
    const drawAt = (block) => {
      const w = Math.max(1, Math.round(img.naturalWidth / block));
      const h = Math.max(1, Math.round(img.naturalHeight / block));
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.clearRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
    };
    const play = () => {
      if (!ready || !visible || played) return;
      played = true;
      sfx.play('power');
      let i = 0;
      const next = () => {
        i++;
        if (i >= steps.length) {
          box.classList.add('is-revealed');
          box.classList.remove('is-pixel');
          window.setTimeout(() => cv.remove(), 500);
          return;
        }
        drawAt(steps[i]);
        window.setTimeout(next, 110);
      };
      window.setTimeout(next, 280);
    };
    const onReady = () => {
      if (!img.naturalWidth) return;
      ready = true;
      box.classList.add('is-pixel');
      drawAt(steps[0]);
      play();
    };
    if (img.complete && img.naturalWidth) onReady();
    else img.addEventListener('load', onReady, { once: true });
    img.addEventListener('error', () => cv.remove(), { once: true });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          visible = en.isIntersecting && en.intersectionRatio >= 0.4;
          if (visible) play();
          if (played) io.disconnect();
        });
      },
      { threshold: [0, 0.4, 0.75] }
    );
    io.observe(box);
  }

  /* ---------------- orari + "aperto ora" ---------------- */
  function initHours() {
    const badges = $$('[data-status]');
    const update = () => {
      const now = romeNow();
      if (now.day == null || Number.isNaN(now.min)) return;
      const label = statusLabel(openStatus(now.day, now.min));
      badges.forEach((b) => {
        b.hidden = false;
        b.dataset.state = label.state;
        const text = $('[data-status-text]', b);
        if (!text) return;
        text.textContent = '';
        const strong = doc.createElement('strong');
        strong.textContent = label.head;
        text.append(strong);
        if (label.tail) text.append(` · ${label.tail}`);
      });
      $$('.hours tr[data-day]').forEach((tr) => {
        const today = Number(tr.dataset.day) === now.day;
        tr.classList.toggle('is-today', today);
        if (today) tr.setAttribute('aria-current', 'date');
        else tr.removeAttribute('aria-current');
      });
    };
    update();
    window.setInterval(update, 30000);
  }

  /* ---------------- footer: CONTINUE? 9… ---------------- */
  function initContinue() {
    const box = $('#continue');
    const n = $('#continue-n');
    const q = $('#continue-q');
    if (!box || !n || !q) return;
    let v = 9;
    let timer = 0;
    let visible = false;
    const schedule = (ms, fn) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, ms);
    };
    const tick = () => {
      timer = 0;
      if (!visible) return;
      if (v > 0) {
        v--;
        n.textContent = String(v);
        if (!reduced) {
          n.classList.remove('tick');
          void n.offsetWidth;
          n.classList.add('tick');
        }
        schedule(1000, tick);
      } else {
        box.classList.add('is-zero');
        q.textContent = 'Inserisci gettone!';
        schedule(1800, () => {
          v = 9;
          n.textContent = '9';
          q.textContent = 'Continue?';
          box.classList.remove('is-zero');
          if (visible) schedule(1000, tick);
          else timer = 0;
        });
      }
    };
    watch(box, (on) => {
      visible = on;
      if (on && !timer) schedule(1000, tick);
    });
  }
}
