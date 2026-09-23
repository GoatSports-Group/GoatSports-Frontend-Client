// GOAT boot splash — main-thread bootstrap (GOAT-DESIGN.md "Boot splash").
// Renders boot-splash-scene.js in a Web Worker on an OffscreenCanvas, so Angular parsing and
// bootstrapping on this thread can't make the animation stutter; without OffscreenCanvas the
// scene runs here. No WebGL or reduced motion: the CSS layer in index.html is the whole splash.
const root = document.getElementById('goat-boot');
const canvas = root?.querySelector('.goat-boot__stage');
const logo = root?.querySelector('.goat-boot__logo');

if (root && canvas && logo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  start().catch(() => {
    // Any failure leaves the CSS splash in place.
  });
}

async function start() {
  await logo.decode();
  const breatheTime = Number(logo.getAnimations?.()[0]?.currentTime ?? 0);
  const size = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, logoPx: logo.offsetWidth });
  const init = { ...size(), breatheOffset: breatheTime - (performance.timeOrigin + performance.now()) };
  const show = () => root.classList.add('is-3d');
  let send;
  let stop;

  if (canvas.transferControlToOffscreen) {
    const bitmap = await createImageBitmap(logo, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    const worker = new Worker(new URL('./boot-splash-scene.js', import.meta.url), { type: 'module' });
    const offscreen = canvas.transferControlToOffscreen();
    worker.onmessage = ({ data }) => (data === 'ready' ? show() : worker.terminate());
    worker.onerror = () => worker.terminate();
    worker.postMessage({ type: 'init', canvas: offscreen, logo: bitmap, ...init }, [offscreen, bitmap]);
    send = message => worker.postMessage(message);
    stop = () => worker.terminate();
  } else {
    const { createScene } = await import('./boot-splash-scene.js');
    const scene = createScene({ canvas, logo, ...init, onReady: show });
    send = message => scene[message.type](message);
    stop = () => scene.dispose();
  }

  const onResize = () => send({ type: 'resize', ...size() });
  const onPointer = e => send({ type: 'pointer', x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 });
  const release = () => {
    removeEventListener('resize', onResize);
    removeEventListener('pointermove', onPointer);
    stop();
  };
  // The app removes #goat-boot once its first screen is ready: release the GPU with it.
  if (!root.isConnected) return release();
  addEventListener('resize', onResize);
  addEventListener('pointermove', onPointer, { passive: true });
  new MutationObserver((_, observer) => {
    if (root.isConnected) return;
    observer.disconnect();
    release();
  }).observe(root.parentNode, { childList: true });
}
