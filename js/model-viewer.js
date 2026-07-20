// ============================================================
// POLAR SIAM — GLB model viewer: drag left/right to rotate (horizontal only)
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function initModelViewer(container, url) {
  const canvas = document.createElement("canvas");
  canvas.className = "model-viewer__canvas";
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  // neutral studio lighting so PBR materials read well without an HDR file
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 4, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-3, 1, -2); scene.add(fill);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  const pivot = new THREE.Group();   // rotate this (model is centred inside it)
  scene.add(pivot);

  // ---- interaction: horizontal drag → rotation.y, with momentum ----
  let rotY = 0, velocity = 0, dragging = false, lastX = 0, loaded = false;
  const SENS = 0.0095;   // radians per pixel
  const FRICTION = 0.94;

  canvas.style.touchAction = "pan-y"; // let the page scroll vertically; we take horizontal
  canvas.addEventListener("pointerdown", (e) => {
    if (!loaded) return;
    dragging = true; lastX = e.clientX; velocity = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    container.classList.add("is-grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    rotY += dx * SENS;
    velocity = dx * SENS;
  });
  const release = () => { dragging = false; container.classList.remove("is-grabbing"); };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // ---- load the model ----
  new GLTFLoader().load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      // Centre VERTICALLY on the figure; keep x/z as authored (figures export on the origin).
      // Robust to a stray/offset mesh that would otherwise skew the bbox centre & size.
      model.position.set(0, -center.y, 0);
      pivot.add(model);

      // Frame by HEIGHT so one over-wide mesh can't shrink the figure.
      const fov = camera.fov * Math.PI / 180;
      let dist = (size.y / 2) / Math.tan(fov / 2);
      dist *= 1.4;                           // breathing room
      camera.position.set(0, 0, dist);
      camera.near = dist / 100; camera.far = dist * 100;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);

      loaded = true;
      container.classList.add("is-loaded");
    },
    undefined,
    (err) => { console.error("[model-viewer] failed to load", url, err); container.classList.add("is-error"); }
  );

  // ---- resize ----
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---- only render while on screen ----
  let inView = true;
  new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }).observe(container);

  // ---- loop ----
  function tick() {
    if (!dragging) {
      rotY += velocity;
      velocity *= FRICTION;
      if (Math.abs(velocity) < 0.00004) velocity = 0;
    }
    pivot.rotation.y = rotY;
    if (inView) renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

// lazy-init each viewer as it nears the viewport (defers GLB downloads + WebGL contexts)
const _mvIO = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    obs.unobserve(e.target);
    initModelViewer(e.target, e.target.dataset.src);
  });
}, { rootMargin: "300px 0px" });
document.querySelectorAll(".model-viewer[data-src]").forEach((el) => _mvIO.observe(el));

// ---------------------------------------------------------------
// Focus preview overlay: tap/click a lookbook model to open a larger view
// while preserving the same interactive viewer instance (drag/rotate).
// ---------------------------------------------------------------
let focusOverlay = null;
let focusStage = null;
let activeViewer = null;
let activeParent = null;
let activeNextSibling = null;

function ensureFocusOverlay() {
  if (focusOverlay) return;
  focusOverlay = document.createElement("div");
  focusOverlay.className = "lookbook-focus-overlay";
  focusOverlay.setAttribute("aria-hidden", "true");
  focusOverlay.innerHTML = '<div class="lookbook-focus-card"><div class="lookbook-focus-stage" id="lookbookFocusStage"></div></div>';
  document.body.appendChild(focusOverlay);
  focusStage = focusOverlay.querySelector("#lookbookFocusStage");

  focusOverlay.addEventListener("click", closeLookbookFocus);
  focusOverlay.querySelector(".lookbook-focus-card")?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLookbookFocus();
  });
}

function openLookbookFocus(viewerEl) {
  if (!viewerEl) return;
  ensureFocusOverlay();
  if (!focusOverlay || !focusStage) return;
  if (activeViewer === viewerEl && focusOverlay.classList.contains("is-open")) return;

  if (activeViewer) closeLookbookFocus();

  activeViewer = viewerEl;
  activeParent = viewerEl.parentNode;
  activeNextSibling = viewerEl.nextSibling;

  focusStage.appendChild(viewerEl);
  focusOverlay.classList.add("is-open");
  focusOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lookbook-focus-open");
}

function closeLookbookFocus() {
  if (!activeViewer || !activeParent) {
    if (focusOverlay) {
      focusOverlay.classList.remove("is-open");
      focusOverlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lookbook-focus-open");
    }
    return;
  }

  if (activeNextSibling && activeNextSibling.parentNode === activeParent) {
    activeParent.insertBefore(activeViewer, activeNextSibling);
  } else {
    activeParent.appendChild(activeViewer);
  }

  activeViewer = null;
  activeParent = null;
  activeNextSibling = null;

  if (focusOverlay) {
    focusOverlay.classList.remove("is-open");
    focusOverlay.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("lookbook-focus-open");
}

document.querySelectorAll(".look--model .model-viewer[data-src]").forEach((viewer) => {
  let startX = 0;
  let startY = 0;
  let moved = false;

  viewer.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
  });

  viewer.addEventListener("pointermove", (event) => {
    if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) moved = true;
  });

  viewer.addEventListener("pointerup", () => {
    if (!moved) openLookbookFocus(viewer);
  });
});
