import {
  AmbientLight,
  CanvasTexture,
  Color,
  ColorManagement,
  DirectionalLight,
  Group,
  LinearSRGBColorSpace,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLRenderer,
} from "three";

import { loadImage } from "./statue";

/*
 * 아틀라스가 받친 지구. NASA Blue Marble 지형(8192 × 4096, 색 보정·선명하게 구움)과 구름 알파맵(4096 × 2048)을 쓴다.
 * 계속 자전하고, 끌면 손으로 돌리다가 놓으면 다시 자전으로 돌아간다.
 * 확정 시안은 three r128 로 만들었다. 같은 빛과 색이 나오게 색 관리를 끄고(텍스처 · 출력 모두 그대로),
 * 지금 버전의 물리 단위 빛에 맞춰 세기에 π 를 곱한다.
 */
ColorManagement.enabled = false;

type Spin = { step: (dt: number) => void; lon: number; lat: number; dispose: () => void };

/** lon 은 화면 쪽을 향한 경도. 오른쪽으로 끌면(= 지구가 동쪽으로 돌면) 줄어든다 */
function spinner(el: HTMLCanvasElement, reduced: boolean): Spin {
  const k = 0.3;
  const [latMin, latMax] = [-40, 50];
  const s = { lon: 127.5, lat: 0, vLon: 0, vLat: 0, idle: 9, drag: false, px: 0, py: 0 };
  const auto = reduced ? 0 : 6;
  const down = (e: PointerEvent) => {
    Object.assign(s, { drag: true, px: e.clientX, py: e.clientY, vLon: 0, vLat: 0 });
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = "";
  };
  const move = (e: PointerEvent) => {
    if (!s.drag) return;
    const kk = k / (el.clientWidth / 600);
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    s.px = e.clientX;
    s.py = e.clientY;
    s.lon -= dx * kk;
    s.vLon = -dx * kk * 60;
    s.lat = Math.max(latMin, Math.min(latMax, s.lat + dy * kk));
    s.vLat = dy * kk * 60;
    s.idle = 0;
  };
  const up = (e: PointerEvent) => {
    if (!s.drag) return;
    s.drag = false;
    delete el.dataset.dragging;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return {
    get lon() {
      return s.lon;
    },
    get lat() {
      return s.lat;
    },
    step(dt) {
      if (s.drag) return;
      s.idle += dt;
      s.lon += s.vLon * dt;
      s.vLon *= Math.pow(0.04, dt);
      s.lat = Math.max(latMin, Math.min(latMax, s.lat + s.vLat * dt));
      s.vLat *= Math.pow(0.04, dt);
      // 손을 놓고 2초 뒤부터 1.5초에 걸쳐 자전 속도로 돌아간다
      s.lon -= auto * Math.min(1, Math.max(0, (s.idle - 2) / 1.5)) * dt;
    },
    dispose() {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    },
  };
}

/* 얇은 대기 테두리. 직교 카메라라 시선은 늘 +z. 아래로 갈수록 옅어져 머리 · 손이 닿는 곳에 밝은 이음매가 생기지 않는다 */
function rimMaterial(color: number, power: number, strength: number) {
  return new ShaderMaterial({
    uniforms: { c: { value: new Color(color) }, p: { value: power }, s: { value: strength } },
    vertexShader:
      "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; void main(){ float f = pow(1.0 - max(0.0, vN.z), p) * s * mix(0.12, 1.0, smoothstep(-0.85, 0.05, vN.y)); gl_FragColor = vec4(c, clamp(f, 0.0, 1.0)); }",
    transparent: true,
    depthWrite: false,
  });
}

/**
 * 지구를 그리기 시작하고, 멈추고 치우는 함수를 돌려준다.
 * 이미지를 받는 동안 취소되면(signal) 렌더러를 만들지 않는다: 한 캔버스에 렌더러 둘이 붙으면 GL 상태가 꼬인다
 */
export async function startGlobe(
  canvas: HTMLCanvasElement,
  images: { earth: string; clouds: string },
  reduced: boolean,
  signal: AbortSignal,
) {
  const [earth, cloudImg] = await Promise.all([loadImage(images.earth), loadImage(images.clouds)]);
  if (signal.aborted) return () => undefined;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  // 화면 배율이 1이어도 2배 이상으로 그려 브라우저가 줄이게 한다: 지도와 가장자리가 더 또렷하다
  renderer.setPixelRatio(Math.min(3, Math.max(2, window.devicePixelRatio || 1)));
  // 8192 텍스처를 못 받는 GPU 에는 줄인 사본을 준다
  const maxTex = renderer.capabilities.maxTextureSize;
  const fit = (img: HTMLImageElement) => {
    if (img.width <= maxTex) return img;
    const c = document.createElement("canvas");
    c.width = maxTex;
    c.height = Math.round((img.height * maxTex) / img.width);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };

  const scene = new Scene();
  const cam = new OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 50);
  cam.position.set(0, 0, 10);
  // 부드러운 주광: 밝은 쪽이 0.66 + 0.6 에서 멈춰 사막이 하얗게 날아가지 않는다
  scene.add(new AmbientLight(0xffffff, 0.66 * Math.PI));
  const sun = new DirectionalLight(0xffffff, 0.6 * Math.PI);
  sun.position.set(-3, 2.2, 4);
  scene.add(sun);

  const tex = new CanvasTexture(fit(earth));
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const cloudTex = new CanvasTexture(fit(cloudImg));
  const tilt = new Group();
  const spin = new Group();
  tilt.add(spin);
  scene.add(tilt);
  const globeGeo = new SphereGeometry(1, 128, 128);
  const globeMat = new MeshPhongMaterial({ map: tex, shininess: 8, specular: new Color(0x1a2233) });
  spin.add(new Mesh(globeGeo, globeMat));
  const cloudGeo = new SphereGeometry(1.006, 128, 128);
  const cloudMat = new MeshLambertMaterial({
    color: 0xffffff,
    alphaMap: cloudTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const clouds = new Mesh(cloudGeo, cloudMat);
  spin.add(clouds);
  const rimGeo = new SphereGeometry(1.008, 96, 96);
  const rimMat = rimMaterial(0xbfd8ff, 2.0, 1.0);
  tilt.add(new Mesh(rimGeo, rimMat));

  const s = spinner(canvas, reduced);
  const size = () => renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const observer = new ResizeObserver(size);
  observer.observe(canvas);
  size();

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    s.step(dt);
    spin.rotation.y = MathUtils.degToRad(-(s.lon + 90));
    clouds.rotation.y = MathUtils.degToRad(reduced ? 0 : now * 0.0004);
    tilt.rotation.x = MathUtils.degToRad(24 + s.lat);
    tilt.rotation.z = MathUtils.degToRad(-10);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    s.dispose();
    [globeGeo, cloudGeo, rimGeo, globeMat, cloudMat, rimMat, tex, cloudTex].forEach((x) =>
      x.dispose(),
    );
    renderer.dispose();
  };
}
