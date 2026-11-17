import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import readyJson from "../../../../../contracts/c2/examples/argument-c1-ready.json";
import {
  flowSeries,
  insideLine,
  movementBars,
  movementDots,
  sidoShort,
  VISIBLE_BARS,
} from "./movement";

const ready = argumentSchema.parse(readyJson);
const [seoul] = flowSeries(ready);

/** 계약 예시의 여수 → 서울 줄을 본떠 도착지 · 2025 월 값만 바꾼 줄(2025 는 달마다 그 값, 그 밖은 1) */
const flowTo = (to: string, toName: string, monthly2025: number) => ({
  ...seoul,
  to,
  to_name: toName,
  values: seoul.periods.map((p): number | null => (p.startsWith("2025") ? monthly2025 : 1)),
});

// dev 실제 실행(여수 C1, 11/06)의 2025 합계 순서: 전남(도 안) 18,978 · 경기 1,602 · 서울 1,531 · 광주 1,439 · 전북 596 …
const withFlows = (flows: ReturnType<typeof flowTo>[]) => ({ ...ready, series: flows });

describe("이동형 막대", () => {
  it("계약 예시: 고른 달의 여수 → 서울 이동자 수, 달을 주지 않으면 마지막 달", () => {
    const data = movementBars(ready, "kr-46");
    expect(data?.month).toBe("2025-12");
    expect(data?.bars).toEqual([
      { to: "kr-11", name: "서울", fullName: "서울특별시", value: 141, at: seoul.to_coordinates },
    ]);
    // 슬라이더로 다른 달을 고르면 그 달 값
    const march = movementBars(ready, "kr-46", "2025-03");
    expect([march?.month, march?.bars[0].value]).toEqual(["2025-03", 161]);
    expect(data?.inside).toBeNull();
    expect(data?.from).toEqual(seoul.from_coordinates);
  });

  it("지도 원: 같은 시도 밖 도착지마다 대표점에 하나(이름은 모두), 지름 24 ~ 44(넓이 비율), 큰 순서", () => {
    const flows = [
      flowTo("kr-46", "전라남도(22개 시군)", 1500),
      ...["kr-41", "kr-11", "kr-29", "kr-52", "kr-48", "kr-26", "kr-44", "kr-28"].map((to, i) =>
        flowTo(to, `${to}도`, 400 - i * 40),
      ),
    ];
    const dots = movementDots(movementBars(withFlows(flows), "kr-46")!);
    // 전남(도 안)은 막대처럼 지도에서도 뺀다
    expect(dots.map((d) => d.to)).not.toContain("kr-46");
    expect(dots).toHaveLength(8);
    expect(dots[0].size).toBe(44);
    // 큰 순서라 작은 원이 나중(위)에 놓인다. 가장 작은 원도 두 글자가 들어가는 24 이상
    expect(dots.map((d) => d.size)).toEqual([...dots.map((d) => d.size)].sort((a, b) => b - a));
    expect(Math.min(...dots.map((d) => d.size))).toBeGreaterThanOrEqual(24);
    expect(dots[0]).toMatchObject({ name: "kr-41도", label: "kr-41도 400명" });
    // 대표점이 없는 도착지는 그리지 않는다
    const noPoint = {
      ...flowTo("kr-11", "서울특별시", 10),
      to_coordinates: [null, null] as [null, null],
    };
    expect(movementDots(movementBars(withFlows([noPoint]), null)!)).toEqual([]);
  });

  it("출발지와 같은 시도는 막대 밖 한 줄, 나머지는 모두 큰 순서 막대(7개 넘으면 시트가 스크롤)", () => {
    const data = movementBars(
      withFlows([
        flowTo("kr-46", "전라남도(22개 시군)", 1500),
        flowTo("kr-11", "서울특별시", 120),
        flowTo("kr-41", "경기도", 130),
        flowTo("kr-29", "광주광역시(5개 구)", 110),
        flowTo("kr-52", "전북특별자치도", 50),
        flowTo("kr-48", "경상남도", 48),
        flowTo("kr-26", "부산광역시", 45),
        flowTo("kr-44", "충청남도", 40),
        flowTo("kr-28", "인천광역시", 30),
        flowTo("kr-50", "제주특별자치도", 10),
      ]),
      "kr-46",
    )!;
    expect(data.bars.map((b) => b.name)).toEqual([
      "경기",
      "서울",
      "광주",
      "전북",
      "경남",
      "부산",
      "충남",
      "인천",
      "제주",
    ]);
    expect(data.bars.length).toBeGreaterThan(VISIBLE_BARS);
    expect(data.inside?.value).toBe(1500);
    expect(insideLine(data.inside!, "명")).toBe("전남 도 안 이동 1,500명 (막대 밖, 같은 도 안)");
  });

  it("출발지의 시도를 모르면(경계를 못 받음) 도 안 이동도 막대로, 광역시 안이면 「시 안」", () => {
    const flows = withFlows([
      flowTo("kr-29", "광주광역시(5개 구)", 200),
      flowTo("kr-11", "서울특별시", 100),
    ]);
    expect(movementBars(flows, null)?.bars.map((b) => b.name)).toEqual(["광주", "서울"]);
    const inGwangju = movementBars(flows, "kr-29")!;
    expect(insideLine(inGwangju.inside!, "명")).toBe("광주 시 안 이동 200명 (막대 밖, 같은 시 안)");
  });

  it("고른 달 값이 빈 도착지는 빼고, 이동 줄이 없으면 그리지 않는다", () => {
    const empty = { ...flowTo("kr-11", "서울특별시", 0), values: seoul.periods.map(() => null) };
    expect(movementBars(withFlows([empty]), "kr-46")?.bars).toEqual([]);
    expect(movementBars({ ...ready, series: [] }, "kr-46")).toBeNull();
    // 이동 줄이 없는 결과(A3)에 슬라이더의 달이 넘어와도 죽지 않는다
    expect(movementBars({ ...ready, series: [] }, "kr-46", "2025-12")).toBeNull();
  });

  it("시도 짧은 이름: 괄호를 떼고 두 글자로, 모르는 이름은 괄호만 뗀다", () => {
    expect(sidoShort("전라남도(22개 시군)")).toBe("전남");
    expect(sidoShort("강원특별자치도")).toBe("강원");
    expect(sidoShort("어느 곳 (참고)")).toBe("어느 곳");
  });
});
