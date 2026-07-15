// ============================================================
// POLAR SIAM — main: smooth scroll, reveals, cursor, interactions
// ============================================================
import Lenis from "lenis";
import { animate, stagger, utils } from "animejs";
// 3D scene (js/scene.js) is parked for now — the brand hero is the light "colonnade".

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------
// 1. PRELOADER  →  intro reveal
// ---------------------------------------------------------------
// preloader: the 4-arm mark assembles as the page loads (radial scatter → locked)
function setupLoaderAssemble() {
  const svg = document.querySelector("#loader .loader__logo");
  if (!svg) return null;
  const c = { x: 87.18, y: 115.12 }; // viewBox 174.36 x 230.24 centre
  const arms = [...svg.querySelectorAll(".arm")].map((g) => {
    const b = g.getBBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    let vx = cx - c.x, vy = cy - c.y; const len = Math.hypot(vx, vy) || 1, mag = 175;
    return { g, cx, cy, dx: (vx / len) * mag, dy: (vy / len) * mag, rot: (vx < 0 ? -1 : 1) * 46 };
  });
  return (p) => {
    const inv = 1 - p;
    for (const a of arms) {
      a.g.setAttribute("transform",
        `translate(${(inv * a.dx).toFixed(1)} ${(inv * a.dy).toFixed(1)}) rotate(${(inv * a.rot).toFixed(1)} ${a.cx.toFixed(1)} ${a.cy.toFixed(1)})`);
      a.g.style.opacity = Math.min(1, p * 1.7).toFixed(3);
    }
  };
}

function runLoader(onDone) {
  const loader = document.getElementById("loader");
  const barEl = document.getElementById("loaderBar");
  if (!loader) { onDone(); return; } // pages without a preloader boot straight away

  // the intro plays only ONCE per browser session — skip it when navigating between pages
  let seen = false;
  try { seen = sessionStorage.getItem("ps_intro") === "1"; } catch (e) {}
  if (seen) { loader.style.display = "none"; onDone(); return; }
  try { sessionStorage.setItem("ps_intro", "1"); } catch (e) {}

  const setArms = setupLoaderAssemble();
  if (setArms) setArms(0); // start scattered
  if (reduce) { loader.style.display = "none"; onDone(); return; }

  const state = { v: 0 };
  animate(state, {
    v: 100,
    duration: 2100,
    ease: "inOut(3)",
    onUpdate: () => {
      if (barEl) barEl.style.width = Math.round(state.v) + "%";
      if (setArms) setArms(state.v / 100);
    },
    onComplete: () => {
      animate(loader, {
        opacity: [1, 0],
        duration: 700,
        ease: "inOut(2)",
        onBegin: () => loader.classList.add("is-done"),
        onComplete: () => { loader.style.display = "none"; onDone(); },
      });
    },
  });
}

// ---------------------------------------------------------------
// 2. SMOOTH SCROLL (Lenis) + 3D scene hookup
// ---------------------------------------------------------------
let lenis;
function initScroll() {
  if (reduce) {
    const update = () => updateScrollDriven(window.scrollY);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return;
  }

  lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.085 });
  lenis.on("scroll", ({ scroll, velocity }) => {
    updateScrollDriven(scroll, velocity);
  });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  // nav anchor links → lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id, { offset: 0 }); }
    });
  });
}

// ---------------------------------------------------------------
// 3. SCROLL-DRIVEN: horizontal collection + lookbook parallax + marquee
// ---------------------------------------------------------------
const looks = [...document.querySelectorAll(".look")];
const marquee = document.querySelector(".marquee__belt");
let marqueeX = 0;
let marqueeBoost = 0;

// product turntables: each product scrubs through its frames as it scrolls past
const products = [...document.querySelectorAll(".product")].map((el) => ({
  el, frames: [...el.querySelectorAll(".frame")], last: -1,
  loop360: el.dataset.mode === "360", // continuous full spin vs front↔back
}));

function updateTurntables() {
  const vh = window.innerHeight;
  products.forEach((prod) => {
    const n = prod.frames.length;
    if (!n) return;
    const rect = prod.el.getBoundingClientRect();
    const total = prod.el.offsetHeight - vh;
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    const p = total > 0 ? scrolled / total : 0;
    let idx;
    if (prod.loop360) {
      // continuous wrap: 0 → n → back to front (full 360°)
      idx = Math.floor(p * n) % n;
    } else {
      // palindrome (front → back → front) for 2-frame products
      const loopLen = (n - 1) * 2 || 1;
      const pos = Math.round(p * loopLen);
      idx = pos <= n - 1 ? pos : loopLen - pos;
    }
    if (idx === prod.last) return;
    prod.last = idx;
    prod.frames.forEach((f, i) => { f.style.opacity = i === idx ? "1" : "0"; });
  });
}

// scroll-driven 3D: elements with [data-fx] tilt/recede/pop based on distance from viewport centre (works both directions)
const fxEls = [...document.querySelectorAll("[data-fx]")].map((el) => ({ el, type: el.dataset.fx }));
function updateFx() {
  if (reduce || !fxEls.length) return;
  const vh = window.innerHeight;
  for (const { el, type } of fxEls) {
    const r = el.getBoundingClientRect();
    let p = (r.top + r.height / 2 - vh / 2) / vh * 1.25; // 0 at centre, ± away
    p = Math.max(-1, Math.min(1, p));
    const ty = (-p * 22).toFixed(1);
    const op = Math.max(0.06, 1 - Math.abs(p) * 0.85).toFixed(3);
    let tf;
    if (type === "pop") {
      tf = `perspective(1100px) translate3d(0,${ty}px,0) rotateY(${(p * 20).toFixed(1)}deg) rotateX(${(-p * 5).toFixed(1)}deg) scale(${(1 - Math.abs(p) * 0.12).toFixed(3)})`;
    } else {
      tf = `perspective(1100px) translate3d(0,${ty}px,${(-Math.abs(p) * 110).toFixed(0)}px) rotateX(${(-p * 11).toFixed(1)}deg)`;
    }
    el.style.transform = tf;
    el.style.opacity = op;
  }
}

// scroll-driven ASSEMBLE: the crest's 4 arms fly in from scattered → locked logo (story page)
const assembleSvg = document.querySelector(".assemble");
let assembleArms = [], assembleGrey = null, assembleSection = null;
const A_CENTER = { x: 87.18, y: 115.12 }; // viewBox 174.36 x 230.24, centre
const joinSection = document.querySelector(".join");
const joinTitle = document.querySelector(".join__title");
const joinWords = [...document.querySelectorAll(".join__title .word")];
const joinReadingSpeed = (() => {
  if (!joinSection) return 1.5;
  const v = parseFloat(joinSection.dataset.readingSpeed || "1.5");
  return Number.isFinite(v) && v > 0 ? v : 1.5;
})();
const joinStartOpacity = (() => {
  if (!joinSection) return 0.22;
  const v = parseFloat(joinSection.dataset.textStartOpacity || "0.22");
  return Number.isFinite(v) ? Math.max(0, Math.min(0.9, v)) : 0.22;
})();
function initAssemble() {
  if (!assembleSvg) return;
  assembleSection = assembleSvg.closest("section") || assembleSvg.parentElement;
  assembleGrey = assembleSvg.querySelector(".assemble__grey");
  assembleArms = [...assembleSvg.querySelectorAll(".arm")].map((g) => {
    const b = g.getBBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    let vx = cx - A_CENTER.x, vy = cy - A_CENTER.y;
    const len = Math.hypot(vx, vy) || 1, mag = 160; // scatter distance (user units)
    return { g, cx, cy, dx: (vx / len) * mag, dy: (vy / len) * mag, rot: (vx < 0 ? -1 : 1) * 36 };
  });
  updateAssemble();
}
function updateAssemble() {
  if (!assembleArms.length) return;
  const vh = window.innerHeight;
  const rect = assembleSvg.getBoundingClientRect();      // key off the mark itself
  const markCenter = rect.top + rect.height / 2;
  let p = (vh - markCenter) / (vh * 0.5);                 // 0 = mark at bottom, 1 = mark centred
  p = reduce ? 1 : Math.max(0, Math.min(1, p));
  const inv = 1 - p;
  for (const a of assembleArms) {
    a.g.setAttribute("transform",
      `translate(${(inv * a.dx).toFixed(1)} ${(inv * a.dy).toFixed(1)}) rotate(${(inv * a.rot).toFixed(1)} ${a.cx.toFixed(1)} ${a.cy.toFixed(1)})`);
    a.g.style.opacity = Math.min(1, p * 1.8).toFixed(3);
  }
  if (assembleGrey) assembleGrey.style.opacity = Math.max(0, Math.min(1, (p - 0.72) / 0.28)).toFixed(3);
}

function updateJoinTitleProgress() {
  if (!joinSection || !joinTitle || !joinWords.length) return;
  if (reduce) {
    joinWords.forEach((w) => { w.style.opacity = "1"; });
    return;
  }

  joinSection.style.setProperty("--join-start-opacity", joinStartOpacity.toString());
  const rect = joinSection.getBoundingClientRect();
  const total = Math.max(1, joinSection.offsetHeight - window.innerHeight);
  const pRaw = Math.max(0, Math.min(1, (-rect.top) / total));
  // Shopify-like behavior: lower reading-speed value reveals faster.
  const p = Math.max(0, Math.min(1, pRaw / joinReadingSpeed));
  const seg = 1 / joinWords.length;

  joinWords.forEach((w, i) => {
    const lp = Math.max(0, Math.min(1, (p - i * seg) / seg));
    w.style.opacity = (joinStartOpacity + lp * (1 - joinStartOpacity)).toFixed(3);
  });
}

function updateScrollDriven(scroll, velocity = 0) {
  updateTurntables();
  updateFx();
  updateAssemble();
  updateJoinTitleProgress();

  // capture scroll speed and let marquee consume it with a clear acceleration boost
  marqueeBoost = Math.max(marqueeBoost, Math.min(8, Math.abs(velocity) * 2.6));

  // ---- lookbook parallax ----
  looks.forEach((el) => {
    const speed = parseFloat(el.dataset.speed || "0");
    const r = el.getBoundingClientRect();
    const center = r.top + r.height / 2 - window.innerHeight / 2;
    el.style.transform = `translate3d(0, ${center * speed}px, 0)`;
  });

}
// keep marquee alive even when idle
function marqueeLoop() {
  if (!reduce) {
    // disable CSS keyframes so JS can fully control scroll-reactive speed
    if (marquee && marquee.style.animation !== "none") marquee.style.animation = "none";
    updateScrollDriven(lenis ? lenis.scroll : window.scrollY, 0);
    if (marquee) {
      marqueeX -= 0.7 + marqueeBoost;
      marqueeBoost *= 0.86;
      if (marqueeBoost < 0.05) marqueeBoost = 0;
      const half = marquee.scrollWidth / 2;
      if (-marqueeX >= half) marqueeX += half;
      marquee.style.transform = `translate3d(${marqueeX}px,0,0)`;
    }
  }
  requestAnimationFrame(marqueeLoop);
}

// ---------------------------------------------------------------
// 4. ENTRANCE + ON-SCROLL REVEALS  (anime.js)
// ---------------------------------------------------------------
function playHero() {
  if (reduce || !document.querySelector(".hero__bars")) return; // only on the colonnade hero
  // bars fade in without scaling to avoid a horizontal split seam during load
  animate(".hero__bars-top", {
    opacity: [0, 1],
    duration: 1500, ease: "out(3)",
  });
  animate(".hero__bars-bottom", {
    opacity: [0, 1],
    duration: 1500, delay: 120, ease: "out(3)",
  });
  // the mark rises into the shaft of light
  utils.set(".emblem", { opacity: 0 });
  animate(".emblem", {
    opacity: [0, 1], translateY: [26, 0], scale: [0.92, 1],
    duration: 1400, delay: 450, ease: "out(4)",
  });
  // rails + scroll cue settle in
  utils.set([".hero__rail-inner", ".hero__scroll"], { opacity: 0 });
  animate(".hero__rail-inner", { opacity: [0, 0.62], duration: 1300, delay: 800, ease: "out(2)" });
  animate(".hero__scroll", { opacity: [0, 1], duration: 1000, delay: 1050, ease: "out(2)" });
}

// hero mark: each of the 4 pieces repels away from the cursor, then eases back
function initHeroMark() {
  const svg = document.querySelector(".hero .emblem");
  if (!svg || reduce || window.matchMedia("(hover: none)").matches) return;
  const vb = svg.viewBox.baseVal;
  const arms = [...svg.querySelectorAll(".arm")].map((g) => {
    const b = g.getBBox();
    return { g, cx: b.x + b.width / 2, cy: b.y + b.height / 2, ox: 0, oy: 0, orr: 0 };
  });
  const mouse = { x: -9999, y: -9999 };
  window.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  const RADIUS = 300, PUSH = 72;
  function loop() {
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0) {
      const sx = rect.width / vb.width, sy = rect.height / vb.height;
      for (const a of arms) {
        const ax = rect.left + (a.cx / vb.width) * rect.width;
        const ay = rect.top + (a.cy / vb.height) * rect.height;
        const dx = ax - mouse.x, dy = ay - mouse.y;
        const d = Math.hypot(dx, dy) || 1;
        let tx = 0, ty = 0, trr = 0;
        if (d < RADIUS) {
          const f = 1 - d / RADIUS;
          const push = f * PUSH;
          tx = (dx / d) * push / sx;
          ty = (dy / d) * push / sy;
          trr = f * (dx < 0 ? -1 : 1) * 14;
        }
        a.ox += (tx - a.ox) * 0.15;
        a.oy += (ty - a.oy) * 0.15;
        a.orr += (trr - a.orr) * 0.15;
        a.g.setAttribute("transform", `translate(${a.ox.toFixed(1)} ${a.oy.toFixed(1)}) rotate(${a.orr.toFixed(2)} ${a.cx.toFixed(1)} ${a.cy.toFixed(1)})`);
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

function initReveals() {
  if (reduce) return;
  // generic reveal-up elements (hero ones are handled by playHero)
  const heroEl = document.querySelector(".hero");
  const items = [...document.querySelectorAll(".reveal-up")].filter(
    (el) => !heroEl || !heroEl.contains(el)
  );
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(entry.target, {
        opacity: [0, 1], translateY: [24, 0], duration: 1000, ease: "out(3)",
      });
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  items.forEach((el) => io.observe(el));

  // manifesto: line-by-line clip reveal
  const manifestoLines = document.querySelectorAll(".manifesto__text .ml__in");
  if (manifestoLines.length) {
    utils.set(manifestoLines, { translateY: "110%" });
    const mio = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(".manifesto__text .ml__in", {
          translateY: ["110%", "0%"], duration: 1200, delay: stagger(100), ease: "out(4)",
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    const manifestoEl = document.querySelector(".manifesto");
    if (manifestoEl) mio.observe(manifestoEl);
  }

}

// ---------------------------------------------------------------
// 5. CUSTOM CURSOR + MAGNETIC BUTTONS
// ---------------------------------------------------------------
function initCursor() {
  if (window.matchMedia("(hover: none)").matches) return;
  const cur = document.getElementById("cursor");
  if (!cur) return;
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const cp = { ...pos };
  let scale = 1, targetScale = 1;

  window.addEventListener("pointermove", (e) => { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
  function loop() {
    cp.x += (pos.x - cp.x) * 0.22;
    cp.y += (pos.y - cp.y) * 0.22;
    scale += (targetScale - scale) * 0.2;
    cur.style.transform = `translate(${cp.x}px, ${cp.y}px) translate(-50%, -50%) scale(${scale})`;
    requestAnimationFrame(loop);
  }
  loop();

  document.querySelectorAll("[data-cursor]").forEach((el) => {
    const mode = el.dataset.cursor;
    el.addEventListener("pointerenter", () => { targetScale = mode === "view" ? 2.2 : 1.7; });
    el.addEventListener("pointerleave", () => { targetScale = 1; });
  });

  // magnetic
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${mx * 0.3}px, ${my * 0.4}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = "translate(0,0)"; });
  });
}

// ---------------------------------------------------------------
// 6. NEWSLETTER FORM
// ---------------------------------------------------------------
function initForm() {
  const form = document.getElementById("joinForm");
  const note = document.getElementById("joinNote");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.style.display = "none";
    note.hidden = false;
    if (!reduce) animate(note, { opacity: [0, 1], translateY: [12, 0], duration: 700, ease: "out(3)" });
    // TODO: wire to your email provider (Mailchimp / Formspree / Klaviyo)
  });
}

// ---------------------------------------------------------------
// 7. APPLICATION FORM (We're Hiring) → FormSubmit, no backend
// ---------------------------------------------------------------
function initApplyForm() {
  const form = document.getElementById("applyForm");
  if (!form) return;
  const status = document.getElementById("applyStatus");
  const btn = form.querySelector("button[type=submit]");

  // chip toggle visual state
  form.querySelectorAll(".chip input").forEach((inp) => {
    const sync = () => inp.closest(".chip").classList.toggle("is-on", inp.checked);
    inp.addEventListener("change", sync);
    sync();
  });

  const say = (msg, kind) => { if (status) { status.textContent = msg; status.className = "apply__status is-" + kind; } };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;           // native email validation
    say("Sending…", "info");
    if (btn) btn.disabled = true;
    try {
      const res = await fetch("https://formsubmit.co/ajax/ilyessguesmi7@gmail.com", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      form.querySelectorAll(".chip.is-on").forEach((c) => c.classList.remove("is-on"));
      say("Application sent — we'll be in touch.", "ok");
    } catch (_) {
      say("Couldn't send just now — email studio@polarsiam.com.", "err");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------
// 8. CAREERS SCROLL-REVEAL — "Passe-Partout": clip-path mount wipe
//    Each block seats its details in a fixed order (kicker → title →
//    body → tags → media locks in LAST). One-shot on scroll-in, settles.
// ---------------------------------------------------------------
// split a <br>-delimited title into per-line block spans (node-based, preserves <em>)
function splitCwLines(el) {
  const groups = [[]];
  Array.from(el.childNodes).forEach((n) => {
    if (n.nodeName === "BR") groups.push([]);
    else groups[groups.length - 1].push(n);
  });
  const clean = groups.filter((g) => g.some((n) => n.nodeType !== 3 || n.textContent.trim() !== ""));
  if (clean.length < 2) return null; // single line — leave as one target
  el.textContent = "";
  return clean.map((g) => {
    const s = document.createElement("span");
    s.className = "cw-line";
    g.forEach((n) => s.appendChild(n));
    el.appendChild(s);
    return s;
  });
}

function initCareersReveal() {
  const hire = document.querySelector(".hire");
  const rolesHead = document.querySelector(".roles__head");
  const applyHead = document.querySelector(".apply__head");
  const applyForm = document.getElementById("applyForm");
  if (!hire && !rolesHead && !applyForm) return; // not the careers page

  // JS is alive → cancel the pre-paint fail-safe timer set in the <head>
  try { clearTimeout(window.__fxSafe); } catch (e) {}

  const armed = document.documentElement.classList.contains("fx-armed");
  if (reduce || !armed) { // reduced-motion / not armed → just make sure nothing is hidden
    document.querySelectorAll(".cw").forEach((el) => { el.style.clipPath = "none"; el.style.opacity = "1"; });
    return;
  }

  // hand the hidden state from split titles down onto their individual lines (no flash)
  [
    hire && hire.querySelector("h1"),
    rolesHead && rolesHead.querySelector(".section-title"),
    ...document.querySelectorAll(".role__title"),
  ].filter(Boolean).forEach((t) => {
    const lines = splitCwLines(t);
    if (lines) {
      lines.forEach((ln) => { ln.style.clipPath = "inset(100% 0 0 0)"; ln.style.willChange = "clip-path, transform"; });
      t.style.clipPath = "none"; t.style.willChange = "auto"; t.classList.remove("cw");
    }
  });

  const lines = (t) => { if (!t) return []; const l = t.querySelectorAll(".cw-line"); return l.length ? [...l] : [t]; };

  // clip-path "mount" reveal: proxy 100→0 opens the window (bottom-up, or top-down for alt media)
  function wipe(el, o) {
    o = o || {};
    const dur = o.dur || 1000, delay = o.delay || 0, ease = o.ease || "out(4)";
    const rise = o.rise || 0, down = o.axis === "down", gfx = o.gfx;
    el.style.willChange = "clip-path, transform";
    const seed = { v: 100 };
    animate(seed, {
      v: 0, duration: dur, delay, ease,
      onUpdate: () => {
        const v = seed.v;
        el.style.clipPath = down ? `inset(0 0 ${v}% 0)` : `inset(${v}% 0 0 0)`;
        if (rise) el.style.transform = `translateY(${(v / 100 * rise).toFixed(2)}px)`;
        el.style.opacity = Math.min(1, (100 - v) / 55).toFixed(3);
        if (gfx) gfx.style.transform = `scale(${(1 + v / 100 * 0.06).toFixed(4)})`;
      },
      onComplete: () => {
        el.style.clipPath = "none"; el.style.opacity = "1"; el.style.willChange = "auto";
        if (rise) el.style.transform = "none";
        if (gfx) gfx.style.transform = "none";
      },
    });
  }
  // opacity-only reveal (submit button — must never fight .magnetic's inline transform)
  function fade(el, o) {
    o = o || {};
    el.style.willChange = "opacity";
    const seed = { v: 0 };
    animate(seed, {
      v: 1, duration: o.dur || 800, delay: o.delay || 0, ease: "out(3)",
      onUpdate: () => { el.style.opacity = seed.v.toFixed(3); },
      onComplete: () => { el.style.opacity = "1"; el.style.willChange = "auto"; },
    });
  }

  function playRole(a) {
    const num = a.querySelector(".role__num"), title = a.querySelector(".role__title");
    const desc = a.querySelector(".role__desc"), tags = [...a.querySelectorAll(".role__tags span")];
    const media = a.querySelector(".role__media"), gfx = media && media.querySelector("svg, img");
    const down = a.classList.contains("role--alt");
    if (num) wipe(num, { delay: 0, dur: 720, rise: 10 });
    lines(title).forEach((ln, i) => wipe(ln, { delay: 120 + i * 110, dur: 1000, rise: 16 }));
    if (desc) wipe(desc, { delay: 380, dur: 900, rise: 12 });
    tags.forEach((t, i) => wipe(t, { delay: 520 + i * 70, dur: 640, rise: 8 }));
    if (media) wipe(media, { delay: 260, dur: 1200, ease: "out(3)", axis: down ? "down" : "up", gfx }); // last to settle
  }
  function playHire() {
    const idx = hire.querySelector(".hire__idx"), p = hire.querySelector("p");
    if (idx) wipe(idx, { delay: 0, dur: 820, rise: 12 });
    lines(hire.querySelector("h1")).forEach((ln, i) => wipe(ln, { delay: 180 + i * 130, dur: 1050, rise: 16 }));
    if (p) wipe(p, { delay: 640, dur: 950, rise: 12 });
  }
  function playRolesHead() {
    lines(rolesHead.querySelector(".section-title")).forEach((ln, i) => wipe(ln, { delay: i * 120, dur: 1050, rise: 16 }));
    const tag = rolesHead.querySelector(".section-tag");
    if (tag) wipe(tag, { delay: 320, dur: 850, rise: 10 });
  }
  function playApplyHead() {
    const h = applyHead.querySelector(".section-title"), intro = applyHead.querySelector(".apply__intro");
    if (h) wipe(h, { delay: 0, dur: 1000, rise: 16 });
    if (intro) wipe(intro, { delay: 280, dur: 900, rise: 12 });
  }
  function playApplyForm() {
    let email = null, message = null, chipsLabel = null;
    applyForm.querySelectorAll(".field").forEach((f) => {
      if (f.querySelector("input[type=email]")) email = f;
      else if (f.querySelector("textarea")) message = f;
      else if (f.querySelector(".chips")) chipsLabel = f.querySelector(".field__label");
    });
    const chips = [...applyForm.querySelectorAll(".chip")], submit = applyForm.querySelector(".apply__submit");
    if (email) wipe(email, { delay: 0, dur: 900, rise: 12 });
    if (chipsLabel) wipe(chipsLabel, { delay: 160, dur: 700, rise: 8 });
    chips.forEach((c, i) => wipe(c, { delay: 260 + i * 55, dur: 600, rise: 8 }));
    if (message) wipe(message, { delay: 540, dur: 900, rise: 12 });
    if (submit) fade(submit, { delay: 720, dur: 800 });
  }

  const played = new WeakSet();
  function play(root) {
    if (played.has(root)) return; played.add(root);
    if (root === hire) playHire();
    else if (root === rolesHead) playRolesHead();
    else if (root === applyHead) playApplyHead();
    else if (root === applyForm) playApplyForm();
    else if (root.classList.contains("role")) playRole(root);
  }

  const blocks = [hire, rolesHead, ...document.querySelectorAll(".role"), applyHead, applyForm].filter(Boolean);
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => { if (e.isIntersecting) { obs.unobserve(e.target); play(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  blocks.forEach((b) => io.observe(b));

  // immediate sweep so anything already in view (e.g. .hire after the loader) plays without waiting on IO
  const vh = window.innerHeight;
  blocks.forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.top < vh * 0.9 && r.bottom > 0) { io.unobserve(b); play(b); }
  });
}

// ---------------------------------------------------------------
// 9. STORY WINGED MARK — cursor-tilt "pop" + hover meaning popups
// ---------------------------------------------------------------
function initLogoMark() {
  const stage = document.getElementById("logoStage");
  if (!stage) return; // story page only
  const mark = document.getElementById("logoMark");

  // hover/focus a hotspot → reveal its meaning popup
  const pops = { disc: document.getElementById("pop-disc"), bone: document.getElementById("pop-bone") };
  stage.querySelectorAll(".lm-hit").forEach((hit) => {
    const pop = pops[hit.classList.contains("lm-hit--disc") ? "disc" : "bone"];
    if (!pop) return;
    const show = () => pop.classList.add("is-on");
    const hide = () => pop.classList.remove("is-on");
    hit.addEventListener("pointerenter", show);
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("focus", show);
    hit.addEventListener("blur", hide);
  });

  // cursor-driven 3D tilt so the mark (and its feather "lines") lift toward the pointer
  if (reduce || window.matchMedia("(hover: none)").matches || !mark) return;
  let tX = 0, tY = 0, tS = 1, cX = 0, cY = 0, cS = 1;
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    tY = Math.max(-1, Math.min(1, nx)) * 7;   // rotateY (follows left/right)
    tX = Math.max(-1, Math.min(1, ny)) * -6;  // rotateX (follows up/down)
    tS = 1.04;
  });
  stage.addEventListener("pointerleave", () => { tX = 0; tY = 0; tS = 1; });
  (function loop() {
    cX += (tX - cX) * 0.12; cY += (tY - cY) * 0.12; cS += (tS - cS) * 0.12;
    mark.style.transform = `rotateX(${cX.toFixed(2)}deg) rotateY(${cY.toFixed(2)}deg) scale(${cS.toFixed(3)})`;
    requestAnimationFrame(loop);
  })();
}

// ---------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------
function boot() {
  initCareersReveal(); // FIRST: claims/splits careers .cw nodes before initReveals() sees them
  initScroll();
  initCursor();
  initReveals();
  initForm();
  initApplyForm();
  initHeroMark();
  initLogoMark();
  initAssemble();
  marqueeLoop();
  playHero();
}

runLoader(boot);
