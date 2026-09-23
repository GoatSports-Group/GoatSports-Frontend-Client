// GOAT boot splash — Three.js layer (GOAT-DESIGN.md §6 "Boot splash").
// Kick-off scene: the badge floats on the centre spot with a gold edge and flips every few
// seconds; a football, a basketball and a tennis ball orbit it on a running track with speed
// trails that stretch on each flip; stadium dust drifts behind.
// Each app removes #goat-boot once its first screen is ready; the loop then releases WebGL.
import * as THREE from '../vendor/three/three.module.min.js';

const root = document.getElementById('goat-boot');
const canvas = root?.querySelector('.goat-boot__stage');
const logoImg = root?.querySelector('.goat-boot__logo');

if (root && canvas && logoImg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  try {
    start();
  } catch {
    // No WebGL: the CSS layer is the whole splash.
  }
}

function start() {
  const TAU = Math.PI * 2;
  const RX = 0.95; // orbit radii, in badge heights
  const RZ = 0.5;
  const CYCLE = 3.6; // seconds between flips
  const FLIP = 1.0; // flip duration

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    mesh.scale.setScalar(0.1);
    orbit.add(mesh);
    return { ...spec, mesh };
  });

  const TRAIL = 18;
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
  const trailMat = new THREE.PointsMaterial({ map: dot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
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

  const badge = new THREE.Group();
  stage.add(badge);

  const pointer = new THREE.Vector2();
  const onPointer = e => pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // World units per CSS pixel on the z = 0 plane, so the badge lands exactly on the <img>.
    const unit = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
    const size = logoImg.offsetWidth * unit;
    stage.scale.setScalar(size);
    stage.position.set(0, (0.5 - 0.44) * h * unit, 0); // .goat-boot__logo sits at top: 44%
    trailMat.size = 0.12 * size;
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    removeEventListener('resize', resize);
    removeEventListener('pointermove', onPointer);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  let angle = 0;
  let last = performance.now();
  let shown = false;

  function frame(now) {
    if (!root.isConnected) return dispose();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;

    // Flip: a full turn eased over the last second of each cycle; `kick` peaks mid-flip.
    const c = t % CYCLE;
    const p = c > CYCLE - FLIP ? (c - (CYCLE - FLIP)) / FLIP : 0;
    const flip = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    const kick = Math.sin(Math.PI * p);

    badge.position.y = Math.sin(t * 1.8) * 0.035;
    badge.rotation.set(Math.sin(t * 1.1) * 0.06, Math.sin(t * 0.9) * 0.22 + flip * TAU, 0);
    halo.material.opacity = 0.28 + 0.25 * kick;
    halo.scale.setScalar(1 + 0.08 * kick);

    angle += dt * (1.15 + 3.2 * kick);
    BALLS.forEach((ball, i) => {
      const th = angle + (i * TAU) / BALLS.length;
      ball.mesh.position.set(Math.cos(th) * RX, Math.sin(th * 2 + i) * 0.03, Math.sin(th) * RZ);
      ball.mesh.rotation.x += dt * 5;
      ball.mesh.rotation.z += dt * 2.2;
      const history = trailPos.subarray(i * TRAIL * 3, (i + 1) * TRAIL * 3);
      if (!shown) for (let j = 0; j < TRAIL; j++) ball.mesh.position.toArray(history, j * 3);
      history.copyWithin(3, 0, history.length - 3);
      ball.mesh.position.toArray(history, 0);
    });
    trailGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < DUST; i++) {
      const y = i * 3 + 1;
      dustPos[y] += dt * dustSpeed[i];
      if (dustPos[y] > 5.5) dustPos[y] -= 11;
    }
    dustGeo.attributes.position.needsUpdate = true;

    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.05;
    camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!shown) {
      shown = true;
      root.classList.add('is-3d');
    }
  }

  new THREE.TextureLoader().load(logoImg.currentSrc || logoImg.src, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    buildBadge(badge, texture);
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', onPointer);
    renderer.setAnimationLoop(frame);
  }, undefined, dispose);
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
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
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
