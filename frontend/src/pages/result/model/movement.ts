import { type Argument, type ArgumentSeries, seriesShape } from "@/shared/api";

// 04 이동형(Figma 「결과 · 이동형 · 청년 유출」 — 전출지별 막대 · 선 없음 · 집계 이동량).
// 응답의 이동 줄(flow 모양, 도착 시도마다 한 줄 · 월별 이동자 수)에서 고른 달 값을 도착 시도별 막대로
// (명세 7절 「이동: 고른 달 값 + 도착지별 막대」 — 공통 시간 슬라이더).
// 11/01 대표 결정: 그림만 · 판정 없음 · 고정 문구 「집계 이동량, 이동 경로 아님」, 지도에 선 · 화살표를 그리지 않는다

type FlowSeries = Extract<ArgumentSeries, { to: string }>;

/** 이동 줄 */
export const flowSeries = (a: Argument) =>
  a.series.filter((s): s is FlowSeries => seriesShape(s) === "flow");

/** 고정 문구(11/01 대표 결정 #5, Figma 「전 연령 · 집계 이동량, 이동 경로 아님」) */
export const MOVEMENT_CAPTION = "전 연령 · 집계 이동량, 이동 경로 아님";

/** 시트에 한 번에 보이는 막대 수(Figma 7줄). 더 있으면 위아래로 스크롤(사용자 결정 11/09) */
export const VISIBLE_BARS = 7;

const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

/** 시도 이름에서 괄호(「(22개 시군)」 · 「(5개 구)」)를 뗀 것 */
const cleanName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

/** 막대 · 원 이름표(Figma 34 칸): 「전라남도(22개 시군)」 → 「전남」. 모르는 이름은 괄호만 뗀다 */
export const sidoShort = (name: string) => SIDO_SHORT[cleanName(name)] ?? cleanName(name);

export type MovementBar = {
  to: string;
  name: string;
  fullName: string;
  value: number;
  /** 도착 시도 대표점(지도 원 자리). 없으면 지도에 그리지 않는다 */
  at: [number, number] | null;
};

const lonLatOf = (p: [number | null, number | null] | null | undefined): [number, number] | null =>
  p && p[0] != null && p[1] != null ? [p[0], p[1]] : null;

/**
 * 이동형 막대: 고른 달의 도착 시도별 이동자 수(그 달 값이 없는 시도는 뺀다). 달을 주지 않으면 줄의 마지막 달.
 * 출발지와 같은 시도(parentId — 경계 응답의 그 지역 parent_id)로 간 이동은 막대 밖 한 줄,
 * 나머지는 모두 큰 순서로 막대(시트는 7줄씩 보이고 스크롤)
 */
export function movementBars(a: Argument, parentId: string | null, month?: string) {
  const flows = flowSeries(a);
  // 이동 줄이 없는 결과(A3 등)는 달을 골라도 그리지 않는다
  const picked = flows.length ? (month ?? flows[0].periods.at(-1)) : undefined;
  if (!picked) return null;

  const rows: MovementBar[] = flows.flatMap((s) => {
    const value = s.values[s.periods.indexOf(picked)] ?? null;
    if (value === null) return [];
    const fullName = cleanName(s.to_name ?? s.to);
    return [
      {
        to: s.to,
        name: sidoShort(fullName),
        fullName,
        value,
        at: lonLatOf(s.to_coordinates),
      },
    ];
  });
  const inside = parentId ? (rows.find((r) => r.to === parentId) ?? null) : null;
  return {
    /** 막대가 보이는 달 「YYYY-MM」 */
    month: picked,
    unit: flows[0].unit,
    /** 출발지 대표점(점은 찍지 않고 지도 범위에만 넣는다) */
    from: lonLatOf(flows[0].from_coordinates),
    /** 같은 시도 밖 도착지 전부(큰 순서) — 시트 막대 · 지도 원 */
    bars: rows.filter((r) => r !== inside).sort((x, y) => y.value - x.value),
    inside,
  };
}

/**
 * 지도 원 지름(px): 가장 큰 도착지에 대한 넓이 비율로 24 ~ 44.
 * 모든 원 안에 짧은 이름(두 글자 · 11)을 쓰므로(사용자 결정 11/09) 가장 작은 원도 글자가 들어가게 24
 */
const MIN_DOT = 24;
const MAX_DOT = 44;

/**
 * 이동형 지도 원: 같은 시도 밖 도착지마다 대표점에 원 하나(지름 = 이동자 수 넓이 비율) · 원 안에 짧은 이름.
 * 큰 순서라 작은 원이 나중에 놓여 위에 온다(가까운 원끼리 겹쳐도 작은 원 이름이 가려지지 않게).
 * 선 · 화살표는 그리지 않는다(이동 경로로 읽힌다)
 */
export function movementDots(data: NonNullable<ReturnType<typeof movementBars>>) {
  const max = Math.max(0, ...data.bars.map((r) => r.value));
  return data.bars.flatMap((r) =>
    r.at
      ? [
          {
            to: r.to,
            at: r.at,
            name: r.name,
            label: `${r.fullName} ${countText(r.value)}${data.unit ?? ""}`,
            size: Math.round(
              MIN_DOT + (MAX_DOT - MIN_DOT) * (max > 0 ? Math.sqrt(r.value / max) : 0),
            ),
          },
        ]
      : [],
  );
}

/** 같은 시도 안 이동 줄: 「전남 도 안 이동 18,978명 (막대 밖, 같은 도 안)」. 특별 · 광역시는 「시 안」 */
export function insideLine(inside: MovementBar, unit: string | null) {
  const word = inside.fullName.endsWith("도") ? "도" : "시";
  return `${inside.name} ${word} 안 이동 ${countText(inside.value)}${unit ?? ""} (막대 밖, 같은 ${word} 안)`;
}

/** 「1,602」 */
export const countText = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
