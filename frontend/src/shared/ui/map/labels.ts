import type { PlaceBoundaries } from "@/shared/api";

type Feature = PlaceBoundaries["features"][number];

/** 지역 이름을 붙일 한 점: 가장 넓은 조각의 무게중심(섬이 많은 여수도 본토에 한 번만) */
export function labelPoint(f: Feature): [number, number] {
  let best = f.geometry.coordinates[0][0][0];
  let bestArea = 0;
  for (const [ring] of f.geometry.coordinates) {
    let [a, cx, cy] = [0, 0, 0];
    for (let i = 0; i < ring.length - 1; i++) {
      const [[x0, y0], [x1, y1]] = [ring[i], ring[i + 1]];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

/**
 * 같은 상위 지역의 시군구 여럿을 하나로 묶어 부를 이름(「광주 5개 구」).
 * 이름들의 앞 낱말이 같을 때만 만든다(「광주 동구」 · 「광주 서구」 → 광주). 끝 글자가 다 같으면 「개 구」, 아니면 「곳」
 */
export function groupName(names: string[]): string | null {
  const words = names.map((n) => n.split(" "));
  const head = words[0]?.[0];
  if (!head || words.length < 2 || !words.every((w) => w.length > 1 && w[0] === head)) {
    return null;
  }
  const tail = words[0].at(-1)?.at(-1);
  const unit = words.every((w) => w.at(-1)?.at(-1) === tail) ? `개 ${tail}` : "곳";
  return `${head} ${names.length}${unit}`;
}
