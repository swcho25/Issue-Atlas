/*
 * 석상(1402 × 1122, 팔을 낮고 넓게 벌린 자세)을 지구 아래에 놓는다: 목은 지구 맨 아래, 두 손바닥은 지구 아래 가장자리에.
 * 지구 위로 올라온 팔 부분은 지구 뒤로 사라지게(흐리게) 하고 머리만 앞에 남긴다. 지구 가장자리를 따라 옅은 그늘을 둔다.
 * 바닥 그림자는 석상 실루엣으로 계산한다. 배치 값은 프레임 요소의 CSS 변수(--gx --gy --gr --sw)에서 읽는다.
 */
type Palm = { x: number; y: number; dy: number };
type Fit = {
  gx: number;
  radius: number;
  scale: number;
  left: number;
  top: number;
  palms: Palm[];
  lowerEdge: (x: number) => number;
};

const SUPPORT = {
  neck: [0.5, 235 / 1122],
  palms: [
    [65 / 1402, 120 / 1122],
    [1337 / 1402, 120 / 1122],
  ],
  head: { cx: 0.55, cy: 0.275, rx: 0.105, ry: 0.18 },
} as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const cssNum = (el: HTMLElement, name: string) =>
  parseFloat(getComputedStyle(el).getPropertyValue(name));

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 석상 상자를 지구 기준으로 정한다: 지구 아래 가운데, 목이 지구 맨 아래. --sx · --sy 를 써서 CSS 상자도 따라오게 한다 */
function supportLayout(frame: HTMLElement, W: number, H: number): Fit {
  const gx = cssNum(frame, "--gx");
  const gy = cssNum(frame, "--gy");
  const radius = cssNum(frame, "--gr");
  const scale = cssNum(frame, "--sw") / W;
  const left = gx - (W * scale) / 2;
  const top = gy + radius - SUPPORT.neck[1] * H * scale;
  frame.style.setProperty("--sx", String(left));
  frame.style.setProperty("--sy", String(top));
  const lowerEdge = (x: number) => gy + Math.sqrt(Math.max(0, radius * radius - (x - gx) ** 2));
  const palms = SUPPORT.palms.map(([u, v]) => {
    const x = u * W;
    const y = v * H;
    return { x, y, dy: (lowerEdge(left + x * scale) - top) / scale - y };
  });
  return { gx, radius, scale, left, top, palms, lowerEdge };
}

/** 팔마다 손바닥의 dy 만큼 위아래로 옮긴다. 어깨 쪽과 가슴 아래로 갈수록 0. 아핀 삼각형 그물로 그린다 */
function drawSupportingPose(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, fit: Fit) {
  const W = source.width;
  const H = source.height;
  const nx = 56;
  const ny = 44;
  const V: number[][] = [];
  const vertex = (x: number, y: number) => {
    const upper = 1 - smooth(H * 0.33, H * 0.44, y);
    const l = (1 - smooth(W * 0.17, W * 0.36, x)) * upper;
    const r = smooth(W * 0.64, W * 0.83, x) * upper;
    return [x, y, x, y + fit.palms[0].dy * l + fit.palms[1].dy * r];
  };
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) V.push(vertex((i * W) / nx, (j * H) / ny));
  const tri = (a: number[], b: number[], c: number[]) => {
    const [x0, y0, u0, v0] = a;
    const [x1, y1, u1, v1] = b;
    const [x2, y2, u2, v2] = c;
    const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const m11 = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / d;
    const m12 = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / d;
    const m21 = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / d;
    const m22 = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / d;
    const mx = (u0 + u1 + u2) / 3;
    const my = (v0 + v1 + v2) / 3;
    // 삼각형 사이 머리카락 틈이 보이지 않게 아주 조금 키운다
    const grow = (p: number[]) => [p[2] + (p[2] - mx) * 0.025, p[3] + (p[3] - my) * 0.025];
    const [A, B, C] = [grow(a), grow(b), grow(c)];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(m11, m21, m12, m22, u0 - m11 * x0 - m12 * y0, v0 - m21 * x0 - m22 * y0);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = V[j * (nx + 1) + i];
      const b = V[j * (nx + 1) + i + 1];
      const c = V[(j + 1) * (nx + 1) + i];
      const d = V[(j + 1) * (nx + 1) + i + 1];
      tri(a, b, d);
      tri(a, d, c);
    }
}

/** 석상 원본을 캔버스로 한 번 옮겨 둔다(다시 맞출 때마다 원본에서 그린다) */
export async function loadStatue(src: string) {
  const img = await loadImage(src);
  const source = document.createElement("canvas");
  source.width = img.width;
  source.height = img.height;
  source.getContext("2d")?.drawImage(img, 0, 0);
  return source;
}

/** 지금 지구(가로 · 세로 화면, 창 크기)에 맞춰 석상을 다시 맞추고, 석상과 바닥 그림자를 다시 그린다 */
export function drawStatue(
  frame: HTMLElement,
  statue: HTMLCanvasElement,
  shadow: HTMLCanvasElement,
  source: HTMLCanvasElement,
) {
  const W = source.width;
  const H = source.height;
  statue.width = W;
  statue.height = H;
  const fit = supportLayout(frame, W, H);
  const hd = SUPPORT.head;
  const base = document.createElement("canvas");
  base.width = W;
  base.height = H;
  const baseCtx = base.getContext("2d");
  const ctx = statue.getContext("2d", { willReadFrequently: true });
  if (!baseCtx || !ctx) return;
  drawSupportingPose(baseCtx, source, fit);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(base, 0, 0);
  const pixels = ctx.getImageData(0, 0, W, H);
  const d = pixels.data;
  const reach = Math.max(3, fit.radius * 0.028);
  for (let y = 0; y < H * 0.49; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const X = fit.left + x * fit.scale;
      const Y = fit.top + y * fit.scale;
      if (Math.abs(X - fit.gx) >= fit.radius) continue;
      const below = Y - fit.lowerEdge(X);
      const head = ((x / W - hd.cx) / hd.rx) ** 2 + ((y / H - hd.cy) / hd.ry) ** 2 < 1;
      if (below < 0 && !head) d[i + 3] *= 1 - smooth(0.1, 1.3, -below);
      const shade = 1 - 0.24 * Math.exp(-Math.abs(below) / reach);
      d[i] *= shade * 0.995;
      d[i + 1] *= shade;
      d[i + 2] *= Math.min(1, shade * 1.008);
    }
  ctx.putImageData(pixels, 0, 0);
  drawShadow(shadow, statue, getComputedStyle(frame).getPropertyValue("--landing-shadow").trim());
}

/* 석상 실루엣으로 만든 바닥 그림자(석상 이미지 좌표, 바닥선 G):
   넓고 옅은 그늘, 바닥에 눌린 실루엣, 무릎과 발밑의 진한 접지선 */
function drawShadow(el: HTMLCanvasElement, statue: HTMLCanvasElement, rgb: string) {
  const G = Math.round(statue.height * 0.94);
  const Q = 0.25;
  const X0 = -2300;
  const Y0 = G - 450;
  const tint = (a: number) => `rgba(${rgb}, ${a})`;
  el.width = 6000 * Q;
  el.height = 900 * Q;
  const ctx = el.getContext("2d");
  const sil = document.createElement("canvas");
  sil.width = statue.width;
  sil.height = statue.height;
  const sc = sil.getContext("2d");
  if (!ctx || !sc) return;
  sc.drawImage(statue, 0, 0);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = tint(1);
  sc.fillRect(0, 0, sil.width, sil.height);
  const at = (a: number, d: number, e: number, f: number) =>
    ctx.setTransform(Q * a, 0, 0, Q * d, Q * (e - X0), Q * (f - Y0));

  // 넓은 그늘
  at(1, 1, 0, 0);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, tint(0.12));
  g.addColorStop(0.3, tint(0.06));
  g.addColorStop(0.65, tint(0.02));
  g.addColorStop(1, tint(0));
  ctx.save();
  ctx.translate(725, G - 30);
  ctx.scale(2200, 125);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 바닥선 쪽으로 눌린 실루엣(y → G − 0.1·(G − y)), 조금 넓고 흐리게
  const press = (alpha: number, blur: number, sx: number, sy: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${blur}px)`;
    at(sx, sy, 725 - sx * 725, G - sy * G);
    ctx.drawImage(sil, 0, 0);
    ctx.restore();
  };
  press(0.3, 9, 1.08, 0.1);
  // 같은 실루엣을 더 넓고 흐리게 두 번: 양옆으로 그림자가 뻗는다
  press(0.2, 28, 2.8, 0.15);
  press(0.12, 40, 4.4, 0.17);

  // 접지: 석상 맨 아래 80 px 만 더 세게 누르고 거의 흐리지 않는다
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.filter = "blur(2px)";
  at(1, 0.3, 0, G - 0.3 * G);
  ctx.drawImage(sil, 0, G - 80, sil.width, 120, 0, G - 80, sil.width, 120);
  ctx.restore();
}
