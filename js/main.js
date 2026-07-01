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
function runLoader(onDone) {
  const loader = document.getElementById("loader");
  const countEl = document.getElementById("loaderCount");
  const barEl = document.getElementById("loaderBar");
  if (!loader) { onDone(); return; } // pages without a preloader boot straight away
  if (reduce) { loader.style.display = "none"; onDone(); return; }

  const state = { v: 0 };
  animate(state, {
    v: 100,
    duration: 1900,
    ease: "inOut(3)",
    onUpdate: () => {
      const n = Math.round(state.v);
      countEl.textContent = n;
      barEl.style.width = n + "%";
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
const marquee = document.getElementById("marquee");
let marqueeX = 0;

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

function updateScrollDriven(scroll, velocity = 0) {
  updateTurntables();

  // ---- lookbook parallax ----
  looks.forEach((el) => {
    const speed = parseFloat(el.dataset.speed || "0");
    const r = el.getBoundingClientRect();
    const center = r.top + r.height / 2 - window.innerHeight / 2;
    el.style.transform = `translate3d(0, ${center * speed}px, 0)`;
  });

  // ---- marquee drifts with scroll velocity ----
  if (marquee) {
    marqueeX -= 0.6 + Math.abs(velocity) * 0.4;
    const half = marquee.scrollWidth / 2;
    if (-marqueeX >= half) marqueeX += half;
    marquee.style.transform = `translate3d(${marqueeX}px,0,0)`;
  }
}
// keep marquee alive even when idle
function marqueeLoop() {
  if (!reduce) updateScrollDriven(lenis ? lenis.scroll : window.scrollY, 0);
  requestAnimationFrame(marqueeLoop);
}

// ---------------------------------------------------------------
// 4. ENTRANCE + ON-SCROLL REVEALS  (anime.js)
// ---------------------------------------------------------------
function playHero() {
  if (reduce || !document.querySelector(".hero__bars")) return; // only on the colonnade hero
  // bars wipe down from the top band
  animate(".hero__bars-top, .hero__bars-bottom", {
    opacity: [0, 1], scaleY: [0.92, 1],
    transformOrigin: ["50% 0%", "50% 0%"],
    duration: 1500, delay: stagger(120), ease: "out(3)",
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

  // join title words
  const joinIo = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(".join__title .word", {
        translateY: ["110%", "0%"], duration: 1200, delay: stagger(120), ease: "out(4)",
      });
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  const join = document.querySelector(".join");
  if (join) joinIo.observe(join);
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
// BOOT
// ---------------------------------------------------------------
function boot() {
  initScroll();
  initCursor();
  initReveals();
  initForm();
  marqueeLoop();
  playHero();
}

runLoader(boot);
