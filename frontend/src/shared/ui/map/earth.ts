// 지구 보기에 입히는 사진: 랜딩 지구와 같은 NASA 사진 파일을 그대로 쓴다(랜딩을 본 브라우저는 이미 받아 두었다).
// 위경도 격자(가로 경도 · 세로 위도가 고른) 그림이라 지도(Web Mercator)에 맞게 줄마다 위도를 옮겨 편 뒤
// 캔버스 한 장으로 한 번에 얹는다 — 타일처럼 조각조각 뜨지 않는다
const DIR = "/landing";
const TILES = 8; // earth-t0 ~ t7: 경도 45° 씩, 각 256×1024
const TILE_W = 256;
/** Web Mercator 가 그릴 수 있는 위도 끝 */
export const MERCATOR_LAT = 85.0511;
/** 동아시아 조각(8K 해상도): 한국 둘레를 축소해도 또렷하게 바탕 위에 덧씌운다 */
export const ASIA = { lon: [87, 167], lat: [60, 10] } as const;

/** world · asia = 지도에 얹을 사진, pole = 사진이 닿지 않는 극(위도 85° 위)을 채울 색(사진 맨 윗줄 평균) */
export type Earth = { world: HTMLCanvasElement; asia: HTMLCanvasElement; pole: string };

function edgeColor(el: HTMLCanvasElement, rows = 3) {
  const ctx = el.getContext("2d");
  if (!ctx) return "#e9eef3";
  const px = ctx.getImageData(0, 0, el.width, rows).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += px[i + c];
  const [r, g, b] = sum.map((v) => Math.round(v / (px.length / 4)));
  return `rgb(${r},${g},${b})`;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOf = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

function canvas(width: number, height: number) {
  const el = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2d canvas");
  return { el, ctx };
}

/**
 * 위경도 격자 그림(srcLat 위 → 아래 위도를 덮음)을 Web Mercator 로 편다(outLat 위 → 아래 범위만).
 * 폭은 그대로, 높이는 그 경도 폭에서 Mercator 비율대로. 줄마다 그 위도에 해당하는 원본 줄을 옮겨 그린다
 */
function toMercator(
  src: CanvasImageSource & { width: number; height: number },
  lonSpan: number,
  srcLat: readonly [number, number],
  outLat: readonly [number, number],
) {
  const pxPerRad = src.width / ((lonSpan * Math.PI) / 180);
  const [top, bottom] = [mercY(outLat[0]), mercY(outLat[1])];
  const { el, ctx } = canvas(src.width, Math.round((top - bottom) * pxPerRad));
  for (let y = 0; y < el.height; y++) {
    const lat = latOf(top - (y + 0.5) / pxPerRad);
    const sy = ((srcLat[0] - lat) / (srcLat[0] - srcLat[1])) * src.height;
    ctx.drawImage(src, 0, sy, src.width, 1, 0, y, src.width, 1);
  }
  return el;
}

/** 덧씌우는 조각의 가장자리를 부드럽게 지운다(바탕과 이음매가 보이지 않게) */
function feather(el: HTMLCanvasElement, ratio = 0.08) {
  const ctx = el.getContext("2d");
  if (!ctx) return el;
  ctx.globalCompositeOperation = "destination-out";
  const edge = (x0: number, y0: number, x1: number, y1: number, w: number, h: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  const [dx, dy] = [el.width * ratio, el.height * ratio];
  edge(0, 0, dx, 0, dx, el.height);
  edge(el.width, 0, el.width - dx, 0, dx, el.height);
  edge(0, 0, 0, dy, el.width, dy);
  edge(0, el.height, 0, el.height - dy, el.width, dy);
  return el;
}

async function image(name: string) {
  const img = new Image();
  img.src = `${DIR}/${name}`;
  await img.decode();
  return img;
}

let loading: Promise<Earth> | undefined;

/** 지구 사진(바탕 + 동아시아 조각)을 Mercator 캔버스로. 한 번만 만들고 테마를 바꿔도 다시 쓴다 */
export function loadEarth(): Promise<Earth> {
  loading ??= (async () => {
    const tiles = await Promise.all([...Array(TILES).keys()].map((i) => image(`earth-t${i}.webp`)));
    const flat = canvas(TILE_W * TILES, tiles[0].height);
    tiles.forEach((t, i) => flat.ctx.drawImage(t, i * TILE_W, 0));
    const world = toMercator(flat.el, 360, [90, -90], [MERCATOR_LAT, -MERCATOR_LAT]);
    const asiaImg = await image("earth-asia.webp");
    const asia = feather(toMercator(asiaImg, ASIA.lon[1] - ASIA.lon[0], ASIA.lat, ASIA.lat));
    return { world, asia, pole: edgeColor(world) };
  })();
  // 못 받았으면 다음에 다시 시도한다
  loading.catch(() => (loading = undefined));
  return loading;
}
