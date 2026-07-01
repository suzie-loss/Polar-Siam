// ============================================================
// POLAR SIAM — 3D background: flowing silk + polar dust
// ============================================================
import * as THREE from "three";

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  // ---------- Flowing silk ----------
  const silkUniforms = {
    uTime:     { value: 0 },
    uScroll:   { value: 0 },
    uMouse:    { value: new THREE.Vector2(0, 0) },
    uColorLo:  { value: new THREE.Color(0x070708) }, // near-black fabric
    uColorHi:  { value: new THREE.Color(0x1b1c22) }, // cool charcoal
    uGold:     { value: new THREE.Color(0xc8a86a) }, // champagne rim
  };

  const silkGeo = new THREE.PlaneGeometry(16, 16, 220, 220);
  const silkMat = new THREE.ShaderMaterial({
    uniforms: silkUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScroll;
      uniform vec2  uMouse;
      varying float vElev;
      varying vec3  vNormal;
      varying vec2  vUv;

      // hash / value noise
      vec2 hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(dot(hash(i+vec2(0,0)),f-vec2(0,0)), dot(hash(i+vec2(1,0)),f-vec2(1,0)),u.x),
                   mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)), dot(hash(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);
      }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }

      float surface(vec2 p){
        float t = uTime * 0.18;
        float flow = fbm(p*0.6 + vec2(t, t*0.6));
        flow += 0.5 * fbm(p*1.4 - vec2(t*0.8, t*0.3));
        flow += 0.25 * sin(p.x*1.5 + t*2.0) * cos(p.y*1.2 - t*1.5);
        return flow;
      }

      void main(){
        vUv = uv;
        vec3 pos = position;
        float amp = 1.15 + uScroll * 0.9;
        float elev = surface(pos.xy) * amp;
        // mouse pushes the cloth
        float md = distance(pos.xy, uMouse*5.0);
        elev += smoothstep(4.0, 0.0, md) * 0.5;
        pos.z += elev;

        // approximate normal from neighbours for lighting
        float e = 0.15;
        float zx = surface(pos.xy + vec2(e,0.0))*amp - surface(pos.xy - vec2(e,0.0))*amp;
        float zy = surface(pos.xy + vec2(0.0,e))*amp - surface(pos.xy - vec2(0.0,e))*amp;
        vNormal = normalize(vec3(-zx, -zy, 2.0*e));
        vElev = elev;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorLo;
      uniform vec3 uColorHi;
      uniform vec3 uGold;
      varying float vElev;
      varying vec3  vNormal;
      varying vec2  vUv;

      void main(){
        vec3 L = normalize(vec3(0.4, 0.7, 0.9));
        float diff = clamp(dot(vNormal, L), 0.0, 1.0);
        // fresnel-ish rim using normal.z (view roughly along z)
        float rim = pow(1.0 - clamp(vNormal.z, 0.0, 1.0), 2.2);

        vec3 col = mix(uColorLo, uColorHi, diff);
        col += uGold * rim * 0.9;                    // gold edges
        col += uGold * smoothstep(1.0, 2.2, vElev) * 0.25; // gold on peaks

        // vignette toward edges of the plane so it melts into black
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x)
                   * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float alpha = clamp(edge * (0.55 + rim*0.8 + diff*0.3), 0.0, 1.0);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const silk = new THREE.Mesh(silkGeo, silkMat);
  silk.rotation.x = -0.9;
  silk.position.y = -0.5;
  scene.add(silk);

  // ---------- Polar dust ----------
  const COUNT = 700;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    speeds[i] = 0.05 + Math.random() * 0.12;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xe6cf9c, size: 0.018, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---------- interaction state ----------
  const mouse = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  let scroll = 0;       // normalized 0..1 of page
  let scrollVel = 0;

  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- render loop ----------
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    mouse.x += (target.x - mouse.x) * 0.05;
    mouse.y += (target.y - mouse.y) * 0.05;

    silkUniforms.uTime.value = t;
    silkUniforms.uScroll.value = scroll;
    silkUniforms.uMouse.value.set(mouse.x, mouse.y);

    // silk drifts with scroll + parallax with mouse
    silk.rotation.z = mouse.x * 0.12;
    silk.rotation.x = -0.9 + scroll * 0.5 + mouse.y * 0.06;
    silk.position.y = -0.5 - scroll * 1.5;

    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, -scroll * 0.8, 0);

    // dust falls + recycles
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      p[i * 3 + 1] -= speeds[i] * (0.4 + scrollVel * 2.0) * 0.05;
      p[i * 3]     += Math.sin(t * 0.5 + i) * 0.0015;
      if (p[i * 3 + 1] < -6) p[i * 3 + 1] = 6;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dust.rotation.y = t * 0.02 + mouse.x * 0.1;

    scrollVel *= 0.9;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  // ---------- public API ----------
  return {
    setScroll(progress, velocity = 0) {
      scroll = progress;
      scrollVel = Math.min(Math.abs(velocity), 1);
    },
  };
}
