import { describe, expect, it } from "vitest";

import { contour, liftAt, LOGO_PATHS, OPEN, rightAt, stepSpring } from "./contour";
import { LOGO_GEOMETRY } from "./geometry";

const commands = (d: string) => d.replace(/[^MLCZ]/g, "");

describe("contour", () => {
  it("모든 윤곽이 닫힌 경로이고 숫자가 비지 않는다", () => {
    for (const d of Object.values(LOGO_PATHS)) {
      expect(d).toMatch(/^M[\d.]+ [\d.]+ .* Z$/);
      expect(d).not.toContain("NaN");
    }
  });

  it("긴 변은 직선, 모서리 호와 얼굴은 곡선으로 그린다", () => {
    const d = commands(LOGO_PATHS.right);
    expect(d).toContain("L");
    expect(d.split("C").length - 1).toBeGreaterThan(d.split("L").length - 1);
  });

  it("펼치는 동안 경로 명령 순서가 바뀌지 않아 움직임이 튀지 않는다", () => {
    const rest = commands(contour(rightAt(0)));
    for (let p = 0; p <= 1.04; p += 0.02) expect(commands(contour(rightAt(p)))).toBe(rest);
  });
});

describe("rightAt", () => {
  it("윗날개만 내려가고 얼굴 · 아래쪽 면 · 뒤 접힘은 그대로다", () => {
    const open = rightAt(1);
    LOGO_GEOMETRY.right.forEach((q, i) => {
      if (i < LOGO_GEOMETRY.lipStart || i > LOGO_GEOMETRY.lipEnd) expect(open[i]).toEqual(q);
      else {
        expect(open[i][0]).toBe(q[0]);
        expect(open[i][1]).toBeGreaterThanOrEqual(q[1]);
      }
    });
  });

  it("다 펼치면 윗날개 오른쪽 끝이 휨 깊이만큼 내려간다", () => {
    const i = LOGO_GEOMETRY.lipStart;
    expect(rightAt(1)[i][1] - LOGO_GEOMETRY.right[i][1]).toBeCloseTo(OPEN.bend);
  });
});

describe("liftAt", () => {
  it("다 펼치면 심벌이 떠오르고 격자 가운데를 중심으로 반시계로 기운다", () => {
    expect(liftAt(1)).toBe("translate(0 -46) rotate(-3 283 265)");
    expect(liftAt(0)).toBe("translate(0 0) rotate(0 283 265)");
  });
});

describe("stepSpring", () => {
  it("펼침과 접힘 모두 목표에 정확히 멈춘다", () => {
    for (const target of [1, 0]) {
      let s = { value: 1 - target, velocity: 0 };
      for (let i = 0; i < 240; i++) s = stepSpring(s, target, 1 / 60);
      expect(s).toMatchObject({ value: target, velocity: 0 });
    }
  });

  it("빠르게 오가도 값이 튀지 않고 마지막 목표로 돌아온다", () => {
    let s = { value: 0, velocity: 0 };
    for (let i = 0; i < 1200; i++) {
      s = stepSpring(s, i < 800 ? Number(i % 24 < 12) : 0, 1 / 60);
      expect(s.value).toBeGreaterThan(-0.2);
      expect(s.value).toBeLessThan(1.2);
    }
    expect(s.value).toBe(0);
  });
});
