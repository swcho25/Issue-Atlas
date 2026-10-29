import { LOGO_GEOMETRY } from "./geometry";

type Point = readonly [number, number];

const G = LOGO_GEOMETRY;
/** 이보다 긴 변은 직선으로 둔다(격자 단위) */
const LONG = 28;
/** 두 직선 변이 만나는 꼭짓점의 아주 작은 둥글림 */
const MICRO_RADIUS = 3.2;
/** 꺾임이 이보다 크면(라디안) 곡선으로 잇지 않고 뾰족하게 둔다: 코끝 · 입술 · 틈 끝 */
const SHARP = 1.25;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const unit = (v: Point): Point => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const angle = (a: Point, b: Point) => Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
const num = (v: number) => Number(v.toFixed(3));

/**
 * 꼭짓점 목록을 SVG 경로로 바꾼다. 긴 직선 변은 그대로 직선, 모서리 호와 얼굴 같은 짧은 점들은
 * 점을 지나는 매끈한 3차 베지어로 잇는다. Figma 컴포넌트(Logo/Symbol)와 같은 계산이다.
 */
export function contour(points: readonly Point[], offset: Point = G.offset): string {
  const P: Point[] = [];
  points.forEach((p, i) => {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[(i + 1) % points.length];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const u = unit([p[0] - a[0], p[1] - a[1]]);
    const v = unit([b[0] - p[0], b[1] - p[1]]);
    const turn = angle(u, v);
    if (la > LONG && lb > LONG && turn > 0.35) {
      const d = MICRO_RADIUS / Math.tan((Math.PI - turn) / 2);
      const t1: Point = [p[0] - u[0] * d, p[1] - u[1] * d];
      const t2: Point = [p[0] + v[0] * d, p[1] + v[1] * d];
      P.push(t1, [(t1[0] + t2[0]) / 4 + p[0] / 2, (t1[1] + t2[1]) / 4 + p[1] / 2], t2);
    } else P.push(p);
  });

  const n = P.length;
  const at = (i: number) => P[((i % n) + n) % n];
  const len = (i: number) => Math.hypot(at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1]);
  const tin: Point[] = [];
  const tout: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = at(i - 1);
    const p = at(i);
    const b = at(i + 1);
    const back = unit([p[0] - a[0], p[1] - a[1]]);
    const next = unit([b[0] - p[0], b[1] - p[1]]);
    const longBack = len(i - 1) > LONG;
    const longNext = len(i) > LONG;
    if ((longBack && longNext) || (!longBack && !longNext && angle(back, next) > SHARP)) {
      tin[i] = back;
      tout[i] = next;
    } else if (longBack) tin[i] = tout[i] = back;
    else if (longNext) tin[i] = tout[i] = next;
    else tin[i] = tout[i] = unit([b[0] - a[0], b[1] - a[1]]);
  }

  const xy = (q: Point) => `${num(q[0] + offset[0])} ${num(q[1] + offset[1])}`;
  let d = `M${xy(P[0])}`;
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const q = at(i + 1);
    const l = len(i);
    if (l > LONG) {
      d += ` L${xy(q)}`;
      continue;
    }
    const c1: Point = [p[0] + (tout[i][0] * l) / 3, p[1] + (tout[i][1] * l) / 3];
    const c2: Point = [q[0] - (tin[(i + 1) % n][0] * l) / 3, q[1] - (tin[(i + 1) % n][1] * l) / 3];
    d += ` C${xy(c1)} ${xy(c2)} ${xy(q)}`;
  }
  return `${d} Z`;
}

/**
 * 펼침 정도(0 정지 ~ 1 펼침, 스프링이 살짝 넘는 1.04까지)에 맞춘 오른쪽 면 꼭짓점.
 * 위쪽 날개만 아래로 휘고, 얼굴 · 아래쪽 면 · 뒤 접힘은 움직이지 않는다.
 */
export function rightAt(progress: number): Point[] {
  const p = clamp(progress, 0, 1.04);
  return G.right.map((q, i) => {
    if (i < G.lipStart || i > G.lipEnd) return q;
    const weight = clamp((q[0] - 201) / 296, 0, 1);
    return [q[0], q[1] + 40 * p * weight] as const;
  });
}

export type SpringState = { value: number; velocity: number; settled?: boolean };

/** 펼침 스프링(ω 15, 감쇠 0.86). 도중에 방향이 바뀌어도 지금 속도에서 이어진다 */
export function stepSpring(state: SpringState, target: number, dt: number): SpringState {
  const h = Math.min(Math.max(dt, 0), 1 / 30);
  const w = 15;
  const velocity =
    state.velocity + (w * w * (target - state.value) - 2 * 0.86 * w * state.velocity) * h;
  const value = state.value + velocity * h;
  const settled = Math.abs(target - value) < 0.00015 && Math.abs(velocity) < 0.002;
  return { value: settled ? target : value, velocity: settled ? 0 : velocity, settled };
}

export const LOGO_PATHS = {
  right: contour(G.right),
  left: contour(G.left),
  smallRight: contour(G.smallRight),
  smallLeft: contour(G.smallLeft),
};
