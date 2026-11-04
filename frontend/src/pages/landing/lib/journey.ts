import * as THREE from "three";

import { SEOUL, type Site } from "./site";

// 랜딩 스크롤 장면: 히어로 지구(석상이 받침) → 구름 → 도착 지역 지도.
// 시제품 docs/design/landing-scroll/index.html 의 장면 코드를 옮겼다. 왜 이렇게 했는지는 그 폴더 README 표에 있다

const ASSET = "/landing/";
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => ease(clamp((x - a) / (b - a)));
const deg = THREE.MathUtils.degToRad;

/** 히어로 설계틀(= 시안 화면 1586 × 992). 지구 중심 · 반지름은 CSS(.frame 의 --gx · --gy · --gr)와 같은 값 */
const FW = 1586,
  FH = 992,
  GX = 793,
  GY = 425.5,
  GR = 205;
/** 히어로에서 화면 가운데에 오는 위도(시안처럼 오스트레일리아 · 남반구 쪽이 보인다) */
const HERO_LAT = -12;
const heroUnit = (w: number, h: number) => Math.min(w / FW, h / FH);

export type JourneyParts = {
  /** 스크롤 길이를 가진 구간. 이 구간을 지나는 동안 장면이 진행된다 */
  journey: HTMLElement;
  globe: HTMLCanvasElement;
  ground: HTMLCanvasElement;
  /** 석상 · 그림자 틀(지구를 따라 옮기고 키운다) */
  atlas: HTMLElement;
  statue: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  hero: HTMLElement;
  clouds: HTMLElement;
  fog: HTMLElement;
  wait: HTMLElement;
  marks: HTMLElement;
  caption: HTMLElement;
  title: HTMLElement;
  attrib: HTMLElement;
};

type Priority = "high" | "low" | "auto";

const ctx2d = (c: HTMLCanvasElement, settings?: CanvasRenderingContext2DSettings) => {
  const g = c.getContext("2d", settings);
  if (!g) throw new Error("2d 캔버스를 쓸 수 없다");
  return g;
};

/** 가장자리를 부드럽게 지우는 알파맵(edge = 가장자리에서 녹아드는 폭의 비율) */
function featherTexture(n: number, edge: number) {
  const c = Object.assign(document.createElement("canvas"), { width: n, height: n });
  const g = ctx2d(c);
  const im = g.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = 255 * smooth(0, edge, Math.min(x, y, n - 1 - x, n - 1 - y) / (n - 1));
      const i = (y * n + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = a;
      im.data[i + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  return new THREE.CanvasTexture(c);
}

/**
 * 장면을 시작하고 멈추는 함수를 돌려준다. WebGL · 그림을 못 쓰면 그 부분만 비고 글자는 그대로 남는다.
 * reduced(움직임 줄이기)면 지구가 저절로 돌지 않고, 스크롤하면 도착 장면으로 바로 넘어간다
 */
export function startJourney(parts: JourneyParts, reduced: boolean, site: Site = SEOUL) {
  const stop = new AbortController();
  const { signal } = stop;
  const cleanups: (() => void)[] = [];
  let raf = 0;

  run(parts, reduced, site, signal, cleanups, (f) => (raf = requestAnimationFrame(f))).catch(
    () => undefined,
  );

  return () => {
    stop.abort();
    cancelAnimationFrame(raf);
    cleanups.forEach((f) => f());
  };
}

async function run(
  el: JourneyParts,
  reduced: boolean,
  SITE: Site,
  signal: AbortSignal,
  cleanups: (() => void)[],
  tick: (f: FrameRequestCallback) => void,
) {
  // 사진은 메인 스레드 밖에서 푼다. priority: 첫 화면에 보이는 것은 high, 스크롤해야 보이는 것은 low
  const loadBitmap = (src: string, flip = false, priority: Priority = "auto") =>
    fetch(ASSET + src, { priority, signal })
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b, flip ? { imageOrientation: "flipY" } : {}));
  const progress = () =>
    clamp((window.scrollY - el.journey.offsetTop) / (el.journey.offsetHeight - window.innerHeight));

  // ---------- 석상: 손바닥을 지구 가장자리에 맞춰 휘고 그늘 · 그림자를 만든 그림을 미리 구워 쓴다 ----------
  // 구운 석상은 반지름 225 · 폭 280 기준: 왼쪽은 지구 중심에서 140, 목은 178.067 아래. 반지름에 맞춰 같은 비율로 줄인다
  {
    const k = GR / 225;
    el.atlas.style.setProperty("--sx", String(GX - 140 * k));
    el.atlas.style.setProperty("--sy", String(GY + 178.067 * k));
    Promise.all([
      loadBitmap("statue-posed.webp", false, "high"),
      loadBitmap("statue-shadow.webp", false, "high"),
    ])
      .then((shots) =>
        [el.statue, el.shadow].forEach((c, i) => {
          const b = shots[i];
          c.width = b.width;
          c.height = b.height;
          ctx2d(c).drawImage(b, 0, 0);
        }),
      )
      .catch(() => undefined);
  }

  // ---------- 지구(three) ----------
  THREE.ColorManagement.enabled = false;
  const canvas = el.globe;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  cleanups.push(() => renderer.dispose());
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // 지도는 따로 그린다: 지구 캔버스를 위에 두고 투명도만 내려 지도와 겹쳐 바꾼다(흰 화면으로 가리지 않는다)
  const gRenderer = new THREE.WebGLRenderer({
    canvas: el.ground,
    antialias: true,
    powerPreference: "high-performance",
  });
  cleanups.push(() => gRenderer.dispose());
  gRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  gRenderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const FOV = 30;
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.001, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.66 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
  sun.position.set(-3, 2.2, 4);
  scene.add(sun);

  // 지구 사진은 보이는 쪽부터 받는다(화면엔 늘 반구만 보인다)
  //  ① 아주 작은 전체 사진(7KB)으로 지구 모양부터 바로 띄우고
  //  ② 2K 사진을 경도 45°씩 자른 8조각을 화면 정면에 가까운 순서로 받아 한 장의 텍스처에 채워 넣는다
  //  ③ 구름 · 확대용 동아시아 조각 · 지도 사진은 정면 조각이 다 온 뒤 낮은 우선순위로 받는다
  const bitmapTexture = (bmp: ImageBitmap) => {
    const t = new THREE.Texture(bmp);
    t.flipY = false;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    return t;
  };
  const FRONT_LON = 131,
    TILES = 8,
    TILE_W = 2048 / TILES; // 처음 화면 정면 경도 = 아래 globeSpin.lon 시작값
  const earthCanvas = Object.assign(document.createElement("canvas"), {
    width: 2048,
    height: 1024,
  });
  const earthCtx = ctx2d(earthCanvas);
  const tex = new THREE.CanvasTexture(earthCanvas);
  tex.anisotropy = maxAniso;
  const baseDrawn = loadBitmap("earth-base.webp", false, "high").then((b) => {
    earthCtx.drawImage(b, 0, 0, 2048, 1024);
    tex.needsUpdate = true;
  });
  const tileGap = (i: number) =>
    Math.abs(((((-180 + (i + 0.5) * (360 / TILES) - FRONT_LON) % 360) + 540) % 360) - 180);
  const earthTiles = [...Array(TILES).keys()]
    .sort((a, b) => tileGap(a) - tileGap(b))
    .map((i, k) => {
      const tile = loadBitmap(`earth-t${i}.webp`, false, k < 4 ? "high" : "auto");
      return baseDrawn
        .then(() => tile)
        .then((b) => {
          earthCtx.drawImage(b, i * TILE_W, 0);
          tex.needsUpdate = true;
        });
    });
  const frontReady = Promise.all(earthTiles.slice(0, 4));
  const earthReady = Promise.all(earthTiles);
  await baseDrawn;
  if (signal.aborted) return;

  const tilt = new THREE.Group(),
    spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);
  const earthLook = { shininess: 8, specular: new THREE.Color(0x1a2233) };
  spin.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.MeshPhongMaterial({ map: tex, ...earthLook }),
    ),
  );
  // 구름은 정면 조각이 다 온 뒤에 받아 서서히 나타낸다(그전엔 빈 알파맵 · 투명)
  const noClouds = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  noClouds.needsUpdate = true;
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    alphaMap: noClouds,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  // 구름 알파맵은 픽셀마다 네 곳을 찍어 평균 낸다(픽셀 한 칸 안을 2 × 2 로 나눠 보는 것과 같다).
  // 사진을 흐리게 하지 않고도, 잘게 흩어진 구름 알갱이가 돌 때 픽셀 사이를 오가며 지글거리는 것을 줄인다
  cloudMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#ifdef USE_ALPHAMAP
  vec2 sdx = dFdx(vAlphaMapUv) * 0.25, sdy = dFdy(vAlphaMapUv) * 0.25;
  diffuseColor.a *= 0.25 * (texture2D(alphaMap, vAlphaMapUv + sdx + sdy).g + texture2D(alphaMap, vAlphaMapUv - sdx - sdy).g
    + texture2D(alphaMap, vAlphaMapUv + sdx - sdy).g + texture2D(alphaMap, vAlphaMapUv - sdx + sdy).g);
#endif`,
    );
  };
  const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.006, 96, 96), cloudMat);
  cloudMesh.renderOrder = 2;
  spin.add(cloudMesh);
  let cloudsAt = 0;
  // 구름층이 흘러간 각도(도). 매 프레임 조금씩 더한다 — 연 뒤 흐른 시간으로 셈하면 오래 켜 둔 뒤 스크롤할 때 쌓인 회전을 한꺼번에 되감는다
  let cloudDrift = 0;
  const cloudEls = [...el.clouds.children] as HTMLElement[];
  frontReady
    .then(() => loadBitmap("clouds-2048.webp", true, "low"))
    .then((cloudImg) => {
      if (signal.aborted) return;
      cloudMat.alphaMap = bitmapTexture(cloudImg);
      renderer.initTexture(cloudMat.alphaMap);
      cloudsAt = performance.now();
      // 화면 앞 구름: 알파맵(검정 = 맑음)을 흰 구름 + 투명도로 바꾸고, 흐림은 미리 한 번만 굽는다(CSS blur 는 매 프레임 비싸다)
      const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300));
      idle(
        () => {
          const c = Object.assign(document.createElement("canvas"), { width: 1600, height: 800 });
          const g = ctx2d(c);
          g.filter = "blur(3px)";
          g.drawImage(cloudImg, 0, 0, c.width, c.height);
          g.filter = "none";
          const im = g.getImageData(0, 0, c.width, c.height);
          const d = im.data;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i];
            d[i] = d[i + 1] = d[i + 2] = 255;
            d[i + 3] = Math.min(255, a * 1.15);
          }
          g.putImageData(im, 0, 0);
          c.toBlob((b) => {
            if (!b || signal.aborted) return;
            const url = URL.createObjectURL(b);
            cleanups.push(() => URL.revokeObjectURL(url));
            cloudEls.forEach((e) => (e.style.backgroundImage = `url(${url})`));
          }, "image/png");
        },
        { timeout: 1500 },
      );
    })
    .catch(() => undefined);
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0xbfd8ff) }, o: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader:
      "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 c; uniform float o; varying vec3 vN; void main(){ float f = pow(1.0 - max(0.0, vN.z), 2.0) * mix(0.12, 1.0, smoothstep(-0.85, 0.05, vN.y)); gl_FragColor = vec4(c, clamp(f, 0.0, 1.0) * o); }",
  });
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(1.008, 64, 64), rimMat);
  rimMesh.renderOrder = 3;
  tilt.add(rimMesh);
  renderer.initTexture(tex);

  const TARGET = SITE.target;

  // 동아시아 조각(경도 87~167°, 위도 10~60°, 8K 해상도): 같은 자리의 구 조각에 붙여 바탕 지구 위에 덧씌운다. 가장자리는 부드럽게 지운다
  const PATCH = { lon: [87, 167], lat: [10, 60] };
  frontReady
    .then(() => loadBitmap("earth-asia.webp", true, "low"))
    .then((img) => {
      if (signal.aborted) return;
      const t = bitmapTexture(img);
      const geo = new THREE.SphereGeometry(
        1.0004,
        64,
        48,
        deg(PATCH.lon[0] + 180),
        deg(PATCH.lon[1] - PATCH.lon[0]),
        deg(90 - PATCH.lat[1]),
        deg(PATCH.lat[1] - PATCH.lat[0]),
      );
      const patch = new THREE.Mesh(
        geo,
        new THREE.MeshPhongMaterial({
          map: t,
          alphaMap: featherTexture(128, 0.1),
          transparent: true,
          depthWrite: false,
          ...earthLook,
        }),
      );
      patch.renderOrder = 1;
      renderer.initTexture(t);
      spin.add(patch);
    })
    .catch(() => undefined);

  // 끌어서 돌리기: 오른쪽으로 끌면 동쪽으로 돌고, 놓으면 관성으로 미끄러지다 2초 뒤부터 자전으로 돌아간다.
  // 스크롤을 시작하면 그 자세에서 도착 지역으로 돌아간다.
  // 손이 가리키는 자세(aim)와 화면에 그리는 자세(lon · lat)를 나눈다: 마우스 신호는 화면 갱신과 박자가 달라
  // (한 프레임에 0개 · 2개씩 들어온다) 그대로 그리면 덜컥인다. 그리는 자세는 매 프레임 aim 을 부드럽게 따라간다
  const globeSpin = {
    lon: 131,
    lat: 0,
    aimLon: 131,
    aimLat: 0,
    vLon: 0,
    vLat: 0,
    idle: 9,
    drag: false,
    px: 0,
    py: 0,
    trail: [] as [number, number, number][],
    from: null as { lon: number; lat: number } | null,
  };
  const LAT_MIN = -40,
    LAT_MAX = 50,
    AUTO_SPIN = reduced ? 0 : 6;
  const onGlobe = (e: PointerEvent) => {
    const w = window.innerWidth,
      h = window.innerHeight,
      u = heroUnit(w, h);
    const cx = (w - FW * u) / 2 + GX * u,
      cy = (h - FH * u) / 2 + GY * u;
    return progress() < 0.03 && Math.hypot(e.clientX - cx, e.clientY - cy) < GR * u;
  };
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!onGlobe(e)) return;
      Object.assign(globeSpin, {
        drag: true,
        px: e.clientX,
        py: e.clientY,
        vLon: 0,
        vLat: 0,
        trail: [],
      });
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const s = globeSpin;
      if (!s.drag) {
        canvas.style.cursor = onGlobe(e) ? "grab" : "";
        return;
      }
      const u = heroUnit(window.innerWidth, window.innerHeight);
      const k = 0.3 / ((2.2 * GR * u) / 600),
        dx = e.clientX - s.px,
        dy = e.clientY - s.py;
      s.px = e.clientX;
      s.py = e.clientY;
      s.aimLon -= dx * k;
      s.aimLat = clamp(s.aimLat + dy * k, LAT_MIN, LAT_MAX);
      s.trail.push([e.timeStamp, s.aimLon, s.aimLat]);
      while (s.trail.length > 2 && e.timeStamp - s.trail[0][0] > 100) s.trail.shift();
      s.idle = 0;
    },
    { signal },
  );
  const release = (e: PointerEvent) => {
    const s = globeSpin;
    if (!s.drag) return;
    s.drag = false;
    canvas.style.cursor = "grab";
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    // 놓기 직전 0.1초 동안 실제로 움직인 속도(도/초)로 관성을 준다. 멈췄다 놓으면 관성 없음
    const a = s.trail[0],
      b = s.trail[s.trail.length - 1];
    if (a && b && b !== a && e.timeStamp - b[0] < 60) {
      const t = (b[0] - a[0]) / 1000;
      s.vLon = clamp((b[1] - a[1]) / t, -360, 360);
      s.vLat = clamp((b[2] - a[2]) / t, -180, 180);
    }
  };
  canvas.addEventListener("pointerup", release, { signal });
  canvas.addEventListener("pointercancel", release, { signal });
  function stepSpin(dt: number) {
    const s = globeSpin;
    if (!s.drag) {
      s.idle += dt;
      s.aimLon += s.vLon * dt;
      s.vLon *= Math.pow(0.04, dt);
      s.aimLat = clamp(s.aimLat + s.vLat * dt, LAT_MIN, LAT_MAX);
      s.vLat *= Math.pow(0.04, dt);
      s.aimLon -= AUTO_SPIN * clamp((s.idle - 2) / 1.5) * dt;
    }
    const f = 1 - Math.exp(-dt * 30); // 약 0.03초 늦게 따라간다 — 손 떨림 · 입력 박자 차이가 사라진다
    s.lon += (s.aimLon - s.lon) * f;
    s.lat += (s.aimLat - s.lat) * f;
  }

  // ---------- 지도: 미리 구운 장면을 겹친 판 ----------
  // 스크롤 중에 지도 타일을 받지 않는다. 같은 중심에서 확대만 다르게 구운 정사각형 사진들을
  // 바깥(넓고 흐림) → 안쪽(좁고 선명) 순으로 겹쳐 두고, 카메라만 내려가며 기울인다
  const Z0 = 8,
    MAP_FOV = 36.87,
    CENTER = SITE.center,
    SIDE = 2048;
  const LEVELS = [3, 4.5, 6, 7.5, 9, 10.5, 11.5, 12.5];
  const WORLD = 512 * 2 ** Z0; // 세계 단위 = 확대 8 단계에서의 화면 1px
  const merc = (lo: number, la: number) => [
    ((lo + 180) / 360) * WORLD,
    ((1 - Math.log(Math.tan(Math.PI / 4 + deg(la) / 2)) / Math.PI) / 2) * WORLD,
  ];
  const [CX, CY] = merc(...CENTER);
  const toGround = (lo: number, la: number) => {
    const [x, y] = merc(lo, la);
    return new THREE.Vector3(x - CX, CY - y, 0);
  };
  const ground = new THREE.Scene();
  ground.fog = new THREE.Fog(0xf7f8fc, 1, 2);
  const gcam = new THREE.PerspectiveCamera(MAP_FOV, 1, 1, 1e6);
  // 장면 가장자리를 부드럽게 지워, 안쪽 장면이 바깥 장면에 이음매 없이 녹아든다
  const feather = featherTexture(256, 0.08);
  const levels = LEVELS.map((z, i) => {
    const s = SIDE * 2 ** (Z0 - z);
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: i === 0 ? null : feather,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    mesh.renderOrder = i;
    ground.add(mesh);
    return { z, mat, ready: false };
  });
  // 사진은 메인 스레드 밖에서 풀고(createImageBitmap), GPU 에는 한 프레임에 한 장씩 올린다
  const queue: (typeof levels)[number][] = [];
  earthReady
    .then(() =>
      levels.forEach((L) =>
        loadBitmap(`liberty-${SITE.tag}${L.z}.webp`, true, "low")
          .then((bmp) => {
            const t = new THREE.Texture(bmp);
            t.flipY = false;
            t.anisotropy = maxAniso;
            t.needsUpdate = true;
            L.mat.map = t;
            L.mat.needsUpdate = true;
            queue.push(L);
          })
          .catch(() => undefined),
      ),
    )
    .catch(() => undefined);
  let groundReady = false,
    lastUpload = 0;

  // 지도 위 표시. 점끼리 선으로 잇지 않는다 — 이동 경로처럼 읽히지 않게.
  // 측정소(대략 위치) → 보도자료 3건 순으로 놓이고, 지명은 확대에 따라 시 → 둘레 시 · 군 → 구로 바뀐다
  // 점 · 말풍선 · 지명은 판에 구워 넣지 않고 화면 좌표로 옮겨 얹는다(늘 또렷하다). 모양은 CSS 의 .marks 안 :global 클래스
  const mark = (cls: string, at: [number, number]) => {
    const wrap = document.createElement("div"),
      node = document.createElement("div");
    node.className = cls;
    wrap.appendChild(node);
    el.marks.appendChild(wrap);
    return { wrap, node, pos: toGround(...at) };
  };
  cleanups.push(() => el.marks.replaceChildren());
  const pins = SITE.pins.map((p) => {
    const m = mark("pin", p.at);
    if (p.text) {
      const bubble = document.createElement("div"),
        kind = document.createElement("b");
      bubble.className = "bubble";
      kind.textContent = p.kind ?? "";
      bubble.append(kind, p.text);
      m.node.appendChild(bubble);
      m.wrap.style.zIndex = "2"; // 말풍선이 달린 점은 다른 점보다 위에(점이 글자를 가리지 않게)
    }
    const dot = document.createElement("div");
    dot.className = ["dot", p.doc ? "doc" : "", p.text ? "" : "small"].join(" ").trim();
    m.node.appendChild(dot);
    return m;
  });
  const places = SITE.places.map(([name, lo, la, zin, zout, kind]) => {
    const m = mark(`place ${kind ?? ""}`.trim(), [lo, la]);
    m.node.textContent = name;
    return { ...m, zin, zout };
  });

  // 카메라: MapLibre 와 같은 셈(중심 · 확대 · 기울기 · 방위)으로 판 위에 놓는다
  const FINAL = SITE.final;
  // 지구와 지도를 '확대 단계' 하나로 잇는다: 지구 카메라 높이 ↔ 지도 확대(화면 세로에 담기는 실제 거리가 같게).
  // 그래서 지구가 지도로 바뀌는 순간 크기 · 위치가 같아, 흰 화면으로 가리지 않고 겹쳐 바꿀 수 있다
  const EARTH_R = 6.371e6,
    M_PER_PX0 = (40075016 * Math.cos(deg(CENTER[1]))) / 512;
  const zoomOfAlt = (alt: number, h: number) =>
    Math.log2(M_PER_PX0 / ((2 * alt * Math.tan(deg(FOV / 2)) * EARTH_R) / h));
  const altOfZoom = (z: number, h: number) =>
    ((M_PER_PX0 / 2 ** z) * h) / (2 * Math.tan(deg(FOV / 2)) * EARTH_R);
  const MAP_IN_SPAN = 1.8; // 지구가 지도로 서서히 바뀌는 확대 구간의 길이(넓을수록 천천히 녹아든다)
  const fwd = new THREE.Vector3(),
    aim = new THREE.Vector3();
  type View = { center: [number, number]; zoom: number; pitch: number; bearing: number };
  function placeGround(v: View, h: number) {
    const dist = (h / 2 / Math.tan(deg(MAP_FOV / 2))) * 2 ** (Z0 - v.zoom);
    aim.copy(toGround(...v.center));
    const b = deg(v.bearing),
      t = deg(v.pitch);
    fwd.set(Math.sin(b), Math.cos(b), 0);
    gcam.position.set(
      aim.x - fwd.x * dist * Math.sin(t),
      aim.y - fwd.y * dist * Math.sin(t),
      dist * Math.cos(t),
    );
    gcam.up.copy(fwd);
    gcam.lookAt(aim);
    gcam.near = dist * 0.05;
    gcam.far = dist * 20;
    gcam.updateProjectionMatrix();
    const fog = ground.fog as THREE.Fog;
    fog.near = dist * 1.35; // 멀리 갈수록 배경색으로 옅어진다
    fog.far = dist * 3.6;
  }
  // 값이 바뀔 때만 DOM 에 쓴다
  const written = new WeakMap<HTMLElement, Record<string, string>>();
  const put = (node: HTMLElement, prop: string, v: string) => {
    let c = written.get(node);
    if (!c) written.set(node, (c = {}));
    if (c[prop] === v) return;
    c[prop] = v;
    node.style.setProperty(prop, v);
  };
  const v3 = new THREE.Vector3();
  function project(
    m: { wrap: HTMLElement; pos: THREE.Vector3 },
    w: number,
    h: number,
    anchor: string,
  ) {
    v3.copy(m.pos).project(gcam);
    const on = v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15;
    put(m.wrap, "visibility", on ? "visible" : "hidden");
    if (on)
      put(
        m.wrap,
        "transform",
        `translate3d(${(((v3.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - v3.y) / 2) * h).toFixed(1)}px, 0) ${anchor}`,
      );
  }

  // ---------- 스크롤 → 장면 ----------
  let dirty = true;
  function resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h, false);
    gRenderer.setSize(w, h, false);
    cam.aspect = gcam.aspect = w / h;
    cam.updateProjectionMatrix();
    dirty = true;
  }
  window.addEventListener("resize", resize, { signal });
  resize();

  let last = performance.now(),
    lastP = -1,
    pS: number | null = null;
  function frameLoop(now: number) {
    if (signal.aborted) return;
    tick(frameLoop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // 미리 구운 지도 사진을 한 장씩 GPU 에 올린다(한꺼번에 올리면 그 순간 멈칫한다). 지구를 끄는 동안엔 미룬다
    if (queue.length && !globeSpin.drag && now - lastUpload > 150) {
      const L = queue.shift()!;
      if (L.mat.map) gRenderer.initTexture(L.mat.map);
      L.ready = true;
      lastUpload = now;
      if (levels.every((l) => l.ready)) {
        groundReady = true;
        gRenderer.compile(ground, gcam);
        dirty = true;
      }
    }
    // 휠 한 칸씩 끊겨 들어오는 스크롤을 부드럽게 따라간다(새로고침 · 큰 점프는 바로 맞춘다)
    const target = reduced ? (progress() > 0.05 ? 1 : 0) : progress();
    if (pS === null || Math.abs(target - pS) > 0.2) pS = target;
    else pS += (target - pS) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - pS) < 0.00005) pS = target;
    const p = pS;
    const heroIdle = p < 0.04; // 히어로에서는 지구가 계속 돈다
    const waiting = !groundReady && p > 0.3;
    const changed = p !== lastP || dirty || waiting;
    lastP = p;
    dirty = false;
    if (!changed && !heroIdle) return;
    const w = window.innerWidth,
      h = window.innerHeight;
    const u = heroUnit(w, h),
      fx = (w - FW * u) / 2,
      fy = (h - FH * u) / 2;
    const cx = fx + GX * u,
      cy = fy + GY * u,
      R = GR * u;
    // 1) 석상 아래 글자가 사라진다(지구 뒤 큰 이름은 그대로 두고, 지구 · 지도가 덮는다)
    const fade = ease(span(p, 0.03, 0.15));
    put(el.hero, "opacity", String(1 - fade));
    put(el.hero, "transform", `translate(-50%, calc(-50% + ${(fade * 14).toFixed(2)}vh))`);
    put(el.hero, "visibility", fade >= 1 ? "hidden" : "visible");
    // 2) 지구가 도착 지역을 향해 돌고 다가가다, 같은 축척의 지도로 서서히 바뀐다(흰 화면으로 가리지 않는다)
    const finZoom = FINAL.zoom + Math.log2(Math.min(1, w / 1440, h / 992)); // 좁거나 낮은 화면에선 그만큼 물러나 측정소가 제목 · 캡션 사이에 든다
    const d0 = Math.sqrt(1 + (h / 2 / (R * Math.tan(deg(FOV / 2)))) ** 2);
    const Z = lerp(zoomOfAlt(d0 - 1, h), finZoom, ease(span(p, 0.12, 0.84))); // 지구부터 도착 지역까지 한 곡선
    // 지도로 바꾸기는 지구가 화면을 모서리까지 다 덮은 뒤에 시작한다 — 그전에 바꾸면 지구 둘레로 뒤 지도가 보인다(가로로 넓은 화면일수록 늦게).
    // 화면 대각선 끝이 지구 가장자리 안쪽에 들어오는 카메라 높이를 셈하고, 대기 테두리 몫으로 조금 더 다가간다
    const halfDiag = Math.atan(Math.tan(deg(FOV / 2)) * Math.hypot(1, w / h));
    const zIn = Math.max(3.2, zoomOfAlt((1 / Math.sin(halfDiag) - 1) * 0.92, h));
    const mapIn = groundReady ? smooth(zIn, zIn + MAP_IN_SPAN, Z) : 0;
    put(canvas, "opacity", (1 - mapIn).toFixed(3));
    put(canvas, "visibility", mapIn < 1 ? "visible" : "hidden");
    put(el.ground, "visibility", mapIn > 0 ? "visible" : "hidden");
    // 아틀라스는 지구를 받친 채 함께 움직인다: 지구가 화면에 그려지는 중심 · 반지름을 그대로 따라 옮기고 키운다.
    // 지구가 커지면 석상은 자연스럽게 화면 아래로 빠진다(다 빠지면 그리지 않는다)
    const off = 1 - ease(span(p, 0.1, 0.32)); // 지구 중심: 히어로 자리(1) → 화면 가운데(0)
    const gcx = w / 2 - (w / 2 - cx) * off,
      gcy = h / 2 - (h / 2 - cy) * off;
    const gR = ((h / 2) * Math.tan(Math.asin(1 / (1 + altOfZoom(Z, h))))) / Math.tan(deg(FOV / 2));
    const atlasOn = mapIn < 1 && gcy + gR * 0.8 < h;
    put(el.atlas, "visibility", atlasOn ? "visible" : "hidden");
    if (atlasOn) {
      put(el.atlas, "transform-origin", `${(GX * u).toFixed(1)}px ${(GY * u).toFixed(1)}px`);
      put(
        el.atlas,
        "transform",
        `translate(-50%, -50%) translate(${(gcx - cx).toFixed(1)}px, ${(gcy - cy).toFixed(1)}px) scale(${(gR / R).toFixed(4)})`,
      );
    }
    if (mapIn < 1) {
      const turn = ease(span(p, 0.04, 0.26)),
        s = globeSpin;
      let tlon = s.lon,
        tlat = HERO_LAT + s.lat;
      if (turn === 0) {
        s.from = null;
        stepSpin(dt);
        tlon = s.lon;
        tlat = HERO_LAT + s.lat;
      } else {
        // 스크롤을 시작한 순간의 자세(끌어서 돌려 둔 자세 그대로)에서 가장 짧은 쪽으로 도착 지역을 향해 돈다
        if (!s.from) {
          s.from = { lon: s.lon, lat: s.lat };
          s.aimLon = s.lon;
          s.aimLat = s.lat;
          s.vLon = s.vLat = 0;
          s.drag = false;
          canvas.style.cursor = "";
        }
        const d = ((((TARGET.lon - s.from.lon) % 360) + 540) % 360) - 180;
        tlon = s.from.lon + d * turn;
        tlat = lerp(HERO_LAT + s.from.lat, TARGET.lat, turn);
      }
      spin.rotation.y = deg(-(tlon + 90));
      tilt.rotation.x = deg(tlat);
      tilt.rotation.z = deg(lerp(-10, 0, turn));
      cloudDrift = (cloudDrift + 0.4 * dt * (1 - turn)) % 360; // 초당 0.4° 흐르다 도착 지역으로 도는 동안 서서히 멈춘다
      cloudMesh.rotation.y = deg(cloudDrift);
      cloudMat.opacity = cloudsAt ? 0.9 * smooth(0, 700, now - cloudsAt) : 0; // 구름은 받으면 0.7초에 걸쳐 나타난다
      const alt = altOfZoom(Z, h);
      cam.position.set(0, 0, 1 + alt);
      cam.lookAt(0, 0, 0);
      // 보이는 깊이만 담는다(가까운 면을 높이에 맞춰 멀리): 구름층(지구 + 0.006)과 지표가 깊이 값을 다투며 깜빡이지 않게
      cam.near = Math.max(0.0005, alt * 0.5);
      cam.far = alt + 2.5;
      cam.updateProjectionMatrix();
      cam.setViewOffset(w, h, (w / 2 - cx) * off, (h / 2 - cy) * off, w, h);
      rimMat.uniforms.o.value = 1 - span(p, 0.2, 0.35);
      renderer.render(scene, cam);
    }
    // 3) 구름 사이를 지나간다: 반투명 구름만 스치고, 화면을 하얗게 덮지 않는다(빠르게 스크롤해도 번쩍이지 않게)
    const cop = 0.6 * ease(span(p, 0.27, 0.36)) * (1 - ease(span(p, 0.44, 0.58)));
    put(el.clouds, "opacity", cop.toFixed(3));
    put(el.clouds, "visibility", cop > 0.001 ? "visible" : "hidden");
    if (cop > 0.001)
      cloudEls.forEach((c, i) => {
        const k = span(p, 0.27, 0.58),
          s = 1 + k * (1.6 + i * 0.7);
        put(c, "transform", `scale(${s.toFixed(3)}) rotate(${((i - 1) * 6 * k).toFixed(2)}deg)`);
      });
    // 안개는 지도 사진이 아직 GPU 에 안 올라왔을 때만 잠깐 덮는다. 바뀌는 동안엔 옅은 막만 살짝
    const hold = waiting && Z > zIn;
    put(el.fog, "opacity", (hold ? 0.98 : 0.22 * Math.sin(Math.PI * mapIn)).toFixed(3));
    put(el.wait, "opacity", hold ? "1" : "0");
    // 4) 도착 지역으로 곧장 내려가며 기울고 돌아 내려앉는다. 확대 · 기울기 · 방위를 한 곡선으로 이어, 중간에 멈칫하는 구간이 없다
    const onGround = mapIn > 0;
    put(el.marks, "display", onGround ? "block" : "none");
    put(el.attrib, "opacity", onGround ? String(0.8 * mapIn) : "0");
    if (onGround) {
      const mk = ease(span(Z, zIn, finZoom));
      const view: View = {
        center: [lerp(CENTER[0], FINAL.center[0], mk), lerp(CENTER[1], FINAL.center[1], mk)],
        zoom: Z,
        pitch: FINAL.pitch * ease(span(p, 0.52, 0.84)),
        bearing: FINAL.bearing * ease(span(p, 0.5, 0.84)),
      };
      placeGround(view, h);
      gRenderer.render(ground, gcam);
      places.forEach((m) => {
        const o =
          smooth(m.zin - 0.4, m.zin + 0.2, view.zoom) *
          (1 - smooth(m.zout - 0.2, m.zout + 0.4, view.zoom));
        put(m.node, "opacity", o.toFixed(3));
        if (o > 0) project(m, w, h, "translate(-50%, -50%)");
        else put(m.wrap, "visibility", "hidden");
      });
      // 5) 근거가 하나씩 지도 위에 놓인다
      pins.forEach((m, i) => {
        const t = ease(span(p, 0.72 + i * 0.008, 0.76 + i * 0.008));
        put(m.node, "opacity", t.toFixed(3));
        put(m.node, "transform", `translateY(${((1 - t) * 12).toFixed(1)}px)`);
        if (t > 0) project(m, w, h, "translate(-50%, -100%)");
      });
    }
    const ct = ease(span(p, 0.88, 0.93));
    put(el.caption, "opacity", ct.toFixed(3));
    put(el.caption, "transform", `translate(-50%, ${((1 - ct) * 12).toFixed(1)}px)`);
    put(el.title, "opacity", ease(span(p, 0.9, 0.95)).toFixed(3));
  }
  tick(frameLoop);
}
