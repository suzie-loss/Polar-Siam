// ============================================================
// POLAR SIAM — GLB model viewer: drag left/right to rotate (horizontal only)
// ============================================================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Mobile tap-preview tuning.
// Edit only these values to tweak mobile popup framing.
const MOBILE_PREVIEW_SETTINGS = {
  distanceMultiplier: 4,     // bigger = more zoom out
  xOffsetFactor: -1.5,      // negative = left, positive = right
  yOffsetFactor: 1          // negative = down, positive = up
};

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

  let modelRoot = null;
  let modelCenter = new THREE.Vector3(0, 0, 0);
  let modelSize = new THREE.Vector3(1, 1, 1);
  let mobileFocusMode = false;

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
      modelRoot = model;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      modelCenter.copy(center);
      modelSize.copy(size);
      // Centre VERTICALLY on the figure; keep x/z as authored (figures export on the origin).
      // Robust to a stray/offset mesh that would otherwise skew the bbox centre & size.
      model.position.set(0, -center.y, 0);
      pivot.add(model);

      loaded = true;
      container.classList.add("is-loaded");
      resize();
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

    // Default framing (desktop and in-tile): preserve existing look.
    const fov = camera.fov * Math.PI / 180;
    const distY = (Math.max(modelSize.y, 0.001) / 2) / Math.tan(fov / 2);
    let dist = distY * 1.4;

    // Mobile popup only: fit full width and height so model can't be cropped.
    const isInFocusStage = container.closest(".lookbook-focus-stage") !== null;
    if (mobileFocusMode && isInFocusStage && window.matchMedia("(max-width: 760px)").matches) {
      const distX = (Math.max(modelSize.x, 0.001) / 2) / (Math.tan(fov / 2) * Math.max(camera.aspect, 0.001));
      dist = Math.max(distY, distX) * MOBILE_PREVIEW_SETTINGS.distanceMultiplier;
    }

    camera.position.set(0, 0, dist);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function setFocusMode(enabled) {
    mobileFocusMode = !!enabled;
    if (modelRoot) {
      if (mobileFocusMode && window.matchMedia("(max-width: 760px)").matches) {
        modelRoot.position.set(
          modelSize.x * MOBILE_PREVIEW_SETTINGS.xOffsetFactor,
          -modelCenter.y + (modelSize.y * MOBILE_PREVIEW_SETTINGS.yOffsetFactor),
          0
        );
      } else {
        modelRoot.position.set(0, -modelCenter.y, 0);
      }
    }
    resize();
  }

  container.__mvSetFocusMode = setFocusMode;
  container.__mvResize = resize;

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
  if (typeof viewerEl.__mvSetFocusMode === "function") {
    viewerEl.__mvSetFocusMode(window.matchMedia("(max-width: 760px)").matches);
  }
  if (typeof viewerEl.__mvResize === "function") {
    viewerEl.__mvResize();
    requestAnimationFrame(() => viewerEl.__mvResize());
  }
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

  if (typeof activeViewer.__mvSetFocusMode === "function") {
    activeViewer.__mvSetFocusMode(false);
  }
  if (typeof activeViewer.__mvResize === "function") {
    activeViewer.__mvResize();
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
