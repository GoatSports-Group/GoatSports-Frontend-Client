// GOAT boot splash — Three.js scene (GOAT-DESIGN.md "Boot splash").
// Normally runs inside a Web Worker on an OffscreenCanvas, so Angular's bootstrap work on the
// main thread can't stall it; boot-splash.js calls createScene() directly when that's unsupported.
// Kick-off scene: the badge breathes on the centre spot with a gold edge and flips every few
// seconds; a football, a basketball and a tennis ball orbit it on a running track with speed
// trails that stretch on each flip; stadium dust drifts behind.
import * as THREE from '../vendor/three/three.module.min.js';

const TAU = Math.PI * 2;
const RX = 0.95; // orbit radii, in badge heights
const RZ = 0.5;
const CYCLE = 3.6; // seconds between flips, counted from the hand-off so the cross-fade never meets a flip
const FLIP = 1.2;
const INTRO = 1.4; // sway, tilt and trails ease in after the hand-off, so the 3D badge starts exactly as the image
const BREATHE_MS = 2400; // same period, lift and scale as the goat-boot-breathe CSS animation
const BREATHE_PX = 6;
const BREATHE_SCALE = 0.025;
const MAX_DPR = 1.5; // full-screen canvas: sharp enough, far fewer pixels than 2x
const TRAIL = 18;

const smooth = x => x * x * (3 - 2 * x);
const easeInOutCubic = x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutBack = x => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const clamp01 = x => Math.min(Math.max(x, 0), 1);
const epochMs = () => performance.timeOrigin + performance.now(); // same clock in window and worker

/**
 * @param canvas HTMLCanvasElement or OffscreenCanvas
 * @param logo the badge: an ImageBitmap flipped for WebGL (worker) or the <img> itself (main-thread fallback)
 * @param breatheOffset epoch ms → CSS breathe animation time, so the 3D badge takes over mid-breath
 */
export function createScene({ canvas, logo, width, height, dpr, logoPx, breatheOffset, onReady }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xdff7ec, 0x07192d, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 6);
  const rim = new THREE.DirectionalLight(0xf2c94c, 1.6);
  rim.position.set(-3, 1, -4);
  scene.add(key, rim);

  const dot = dotTexture();

  // Everything around the badge lives in `stage`, measured in badge heights.
  const stage = new THREE.Group();
  scene.add(stage);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: dot, color: 0x18c38a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.z = -0.35;
  stage.add(halo);

  const badge = new THREE.Group();
  stage.add(badge);
  const texture = new THREE.Texture(logo);
  texture.flipY = !(typeof ImageBitmap !== 'undefined' && logo instanceof ImageBitmap); // bitmaps come pre-flipped
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  buildBadge(badge, texture);

  // Orbit: the track ring, three balls and their trails, tilted so we look at it from above.
  const orbit = new THREE.Group();
  orbit.rotation.set(0.38, 0, -0.16);
  stage.add(orbit);

  const track = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1, 128),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  track.rotation.x = -Math.PI / 2;
  track.scale.set(RX, RZ, 1);
  track.renderOrder = 2;
  orbit.add(track);

  const PHI = (1 + Math.sqrt(5)) / 2;
  const PANELS = [[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI], [1, PHI, 0], [-1, PHI, 0],
    [1, -PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]]
    .map(v => new THREE.Vector3(...v).normalize());
  const BALLS = [
    // Football: dark patches on the 12 pentagon centres.
    { base: 0xf4f6f5, mark: 0x101a2c, trail: 0x9ff5d2, roughness: 0.45, isMark: p => PANELS.some(c => p.dot(c) > 0.94) },
    // Basketball: two great circles plus the two curved seams.
    { base: 0xe0782e, mark: 0x2a160b, trail: 0xffb36b, roughness: 0.7,
      isMark: p => Math.abs(p.x) < 0.035 || Math.abs(p.y) < 0.035 || Math.abs(Math.abs(p.z) - 0.7) < 0.035 },
    // Tennis ball: the saddle-shaped seam.
    { base: 0xd4e83a, mark: 0xf7f7f2, trail: 0xe8ff6a, roughness: 0.9, isMark: p => Math.abs(p.z - 0.9 * (p.x * p.x - p.y * p.y)) < 0.06 },
  ].map(spec => {
    const mesh = ballMesh(spec);
    mesh.scale.setScalar(0);
    orbit.add(mesh);
    return { ...spec, mesh };
  });

  // Trails are sampled along the orbit itself (not from past frames), so they stay evenly
  // spaced whatever the frame rate.
  const trailPos = new Float32Array(BALLS.length * TRAIL * 3);
  const trailCol = new Float32Array(BALLS.length * TRAIL * 3);
  BALLS.forEach((ball, i) => {
    const c = new THREE.Color(ball.trail);
    for (let j = 0; j < TRAIL; j++) {
      const fade = 0.4 * (1 - j / TRAIL) ** 1.6; // additive: darker = more transparent
      trailCol.set([c.r * fade, c.g * fade, c.b * fade], (i * TRAIL + j) * 3);
    }
  });
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trailMat = new THREE.PointsMaterial({ map: dot, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const trails = new THREE.Points(trailGeo, trailMat);
  trails.renderOrder = 2;
  trails.frustumCulled = false;
  orbit.add(trails);

  // Stadium dust, in world space behind the stage.
  const DUST = 240;
  const dustPos = new Float32Array(DUST * 3);
  const dustCol = new Float32Array(DUST * 3);
  const dustSpeed = new Float32Array(DUST);
  const palette = [0xf2c94c, 0x18c38a, 0xffffff].map(hex => new THREE.Color(hex));
  for (let i = 0; i < DUST; i++) {
    const c = palette[i % 3];
    const glow = 0.2 + Math.random() * 0.4;
    dustPos.set([(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 11, -8 + Math.random() * 8], i * 3);
    dustCol.set([c.r * glow, c.g * glow, c.b * glow], i * 3);
    dustSpeed[i] = 0.12 + Math.random() * 0.3;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: dot, size: 0.08, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  const pointerTarget = new THREE.Vector2();

  function resize({ width, height, dpr, logoPx: px }) {
    logoPx = px;
    renderer.setPixelRatio(Math.min(dpr, MAX_DPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // World units per CSS pixel on the z = 0 plane, so the badge lands exactly on the <img>.
    const unit = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height;
    const size = logoPx * unit;
    stage.scale.setScalar(size);
    stage.position.set(0, (0.5 - 0.44) * height * unit, 0); // .goat-boot__logo sits at top: 44%
    trailMat.size = 0.12 * size;
  }

  const orbitPoint = (theta, i, target) =>
    target.set(Math.cos(theta) * RX, Math.sin(theta * 2 + i) * 0.03, Math.sin(theta) * RZ);

  const point = new THREE.Vector3();
  let angle = 0;
  let start = -1;
  let last = 0;

  function frame(now) {
    if (start < 0) start = last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const t = (now - start) / 1000;
    const intro = smooth(clamp01(t / INTRO));

    // Flip: a full turn eased over the last FLIP seconds of each cycle; `kick` peaks mid-flip.
    const c = t % CYCLE;
    const p = c > CYCLE - FLIP ? (c - (CYCLE - FLIP)) / FLIP : 0;
    const kick = Math.sin(Math.PI * p);

    // Breathe in step with the CSS animation the image was running.
    const breathe = (1 - Math.cos((TAU * ((epochMs() + breatheOffset) % BREATHE_MS)) / BREATHE_MS)) / 2;
    badge.position.y = (breathe * BREATHE_PX) / logoPx;
    badge.scale.setScalar(1 + BREATHE_SCALE * breathe);
    badge.rotation.set(Math.sin(t * 1.1) * 0.06 * intro, Math.sin(t * 0.9) * 0.22 * intro + easeInOutCubic(p) * TAU, 0);
    halo.material.opacity = 0.28 + 0.25 * kick;
    halo.scale.setScalar(1 + 0.08 * kick);

    angle += dt * (1.1 + 2.6 * kick);
    const gap = 0.045 * (1 + 1.6 * kick); // trail spacing in radians: longer streaks on the kick
    trailMat.opacity = intro;
    BALLS.forEach((ball, i) => {
      const theta = angle + (i * TAU) / BALLS.length;
      orbitPoint(theta, i, ball.mesh.position);
      ball.mesh.scale.setScalar(0.1 * easeOutBack(clamp01((t - 0.15 - i * 0.12) / 0.8)));
      ball.mesh.rotation.x += dt * 5;
      ball.mesh.rotation.z += dt * 2.2;
      for (let j = 0; j < TRAIL; j++) {
        orbitPoint(theta - j * gap, i, point).toArray(trailPos, (i * TRAIL + j) * 3);
      }
    });
    trailGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < DUST; i++) {
      const y = i * 3 + 1;
      dustPos[y] += dt * dustSpeed[i];
      if (dustPos[y] > 5.5) dustPos[y] -= 11;
    }
    dustGeo.attributes.position.needsUpdate = true;

    const follow = 1 - Math.exp(-dt * 4); // frame-rate independent easing toward the pointer
    camera.position.x += (pointerTarget.x * 0.6 - camera.position.x) * follow;
    camera.position.y += (-pointerTarget.y * 0.4 - camera.position.y) * follow;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  resize({ width, height, dpr, logoPx });
  // Compile shaders and upload textures before the first visible frame, so the hand-off doesn't hitch.
  renderer.compile(scene, camera);
  frame(performance.now());
  onReady();
  renderer.setAnimationLoop(frame);

  return {
    resize,
    pointer: ({ x, y }) => pointerTarget.set(x, y),
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

// Face + stacked silhouettes behind it: reads as a thick gold-edged badge when it turns.
function buildBadge(badge, texture) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const LAYERS = 14;
  const DEPTH = 0.07;
  const face = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  const edge = new THREE.MeshBasicMaterial({ map: texture, color: 0x9a7424, alphaTest: 0.6, side: THREE.DoubleSide, toneMapped: false });

  const front = new THREE.Mesh(plane, face);
  front.renderOrder = 1;
  const back = new THREE.Mesh(plane, face);
  back.position.z = -DEPTH;
  back.rotation.y = Math.PI;
  back.renderOrder = 1;
  badge.add(front, back);
  for (let i = 1; i < LAYERS; i++) {
    const layer = new THREE.Mesh(plane, edge);
    layer.position.z = -(DEPTH * i) / LAYERS;
    badge.add(layer);
  }
}

// Sports balls drawn with vertex colours on a fine icosphere, so seams stay crisp without textures.
function ballMesh({ base, mark, roughness, isMark }) {
  const geometry = new THREE.IcosahedronGeometry(1, 14);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const a = new THREE.Color(base);
  const b = new THREE.Color(mark);
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const c = isMark(p.fromBufferAttribute(position, i).normalize()) ? b : a;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness }));
}

function dotTexture() {
  const size = 64;
  const canvas = typeof OffscreenCanvas === 'undefined'
    ? Object.assign(document.createElement('canvas'), { width: size, height: size })
    : new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Worker entry: boot-splash.js transfers the canvas and the logo, then forwards resize/pointer.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  let scene;
  self.onmessage = ({ data }) => {
    if (data.type !== 'init') return scene?.[data.type](data);
    try {
      scene = createScene({ ...data, onReady: () => self.postMessage('ready') });
    } catch {
      self.postMessage('failed'); // e.g. no WebGL on OffscreenCanvas: the CSS layer stays
    }
  };
}
