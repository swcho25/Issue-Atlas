import { DATA_YEARS, DEFAULT_PERIOD, type Period, yearsPeriod } from "./period";
import type { IssueCard, Place } from "./schema";

// 「문장으로 질문」 해석(Figma 03 「규칙 해석 · 지명 사전 · 이슈 키워드 · 기간 표현」).
// AI 가 아니라 정해 둔 규칙으로 지역 · 이슈 · 기간을 읽는다. 백엔드는 해석된 값과 원래 문장(raw_text)을 함께 받는다.
// 결과는 칩으로 보여 주고 사람이 고친다 — 그래서 잘못 읽어도 그대로 실행되지는 않는다

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/* ───────── 지역: 지명 사전 ───────── */

/** 한 지역을 부를 수 있는 말들: 「여수시」 · 「여수」, 「광주 동구」 · 「광주동구」 · 「동구」 */
function placeAliases(name: string): string[] {
  const words = name.split(" ");
  const last = words.at(-1) ?? name;
  const stem = last.length > 2 ? last.replace(/[시군구]$/, "") : last;
  return [...new Set([name, words.join(""), last, stem].map(norm))];
}

export type PlaceReading = {
  /** 하나로 정해졌을 때 */
  placeId?: string;
  /** 「광주」 처럼 여러 곳에 걸리면 그 후보들(사람이 고른다) */
  options: string[];
  /** 문장에서 지역을 읽은 말(새 이슈 후보 이름을 만들 때 뺀다) */
  said?: string;
};

export function readPlace(text: string, places: Place[]): PlaceReading {
  const t = norm(text);
  // 긴 말부터 맞춘다(「광주동구」 가 「광주」 보다 먼저)
  const hits = places
    .flatMap((p) => placeAliases(p.name).map((alias) => ({ id: p.place_id, alias })))
    .filter(({ alias }) => t.includes(alias))
    .sort((a, b) => b.alias.length - a.alias.length);
  if (hits.length) {
    const top = hits.filter((h) => h.alias.length === hits[0].alias.length);
    const ids = [...new Set(top.map((h) => h.id))];
    if (ids.length === 1) return { placeId: ids[0], options: [], said: top[0].alias };
    return { options: ids, said: top[0].alias };
  }
  // 시 · 도 이름만 있으면(「광주」) 그 아래 시군구가 후보
  const cities = new Map<string, string[]>();
  for (const p of places) {
    const city = p.name.split(" ")[0];
    if (p.name.includes(" ")) cities.set(city, [...(cities.get(city) ?? []), p.place_id]);
  }
  for (const [city, ids] of cities) {
    if (t.includes(norm(city))) return { options: ids, said: norm(city) };
  }
  return { options: [] };
}

/* ───────── 기간: 기간 표현 ───────── */

export type PeriodReading = {
  period: Period;
  /** 문장에 기간이 없어 자료 범위 전체로 채웠다 */
  defaulted: boolean;
  /** 자료 밖 해를 자료 범위로 줄였다 */
  clamped: boolean;
};

const clamp = (y: number) => Math.min(DATA_YEARS.to, Math.max(DATA_YEARS.from, y));

export function readPeriod(text: string): PeriodReading {
  const range = text.match(/(20\d\d)\s*년?\s*(?:[~\-–—]|부터|에서)\s*(20\d\d)/);
  const single = text.match(/(20\d\d)\s*년/) ?? text.match(/(?<!\d)(20\d\d)(?!\d)/);
  const recent = text.match(/(?:최근|지난)\s*(\d+)\s*년/);
  let from: number | undefined;
  let to: number | undefined;
  if (range) [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
  else if (recent) [from, to] = [DATA_YEARS.to - Number(recent[1]) + 1, DATA_YEARS.to];
  else if (/작년|지난해/.test(text)) [from, to] = [DATA_YEARS.to, DATA_YEARS.to];
  else if (single) from = to = Number(single[1]);
  if (from === undefined || to === undefined) {
    return { period: DEFAULT_PERIOD, defaulted: true, clamped: false };
  }
  const [a, b] = [clamp(from), clamp(to)];
  return { period: yearsPeriod(a, b), defaulted: false, clamped: a !== from || b !== to };
}

/* ───────── 이슈: 이슈 키워드 ───────── */

// 이슈 이름에 든 낱말을 사람들이 실제로 쓰는 말로 넓힌다. 카드 ID 가 아니라 낱말에 묶어 새 카드에도 그대로 쓰인다.
// (카드 설계의 키워드는 아직 공개 API 에 없다 — 생기면 이 표 대신 그것을 쓴다)
const SYNONYMS: Record<string, string[]> = {
  청년: ["청년", "젊은", "20대", "30대", "2030", "청년층"],
  유출: ["유출", "떠나", "떠난", "빠져나", "이탈", "나가", "순유출", "전출"],
  정착: ["정착", "머무", "남는", "돌아오", "귀향", "전입"],
  대기질: ["대기", "공기", "미세먼지", "초미세", "먼지", "pm2.5", "pm10", "오염"],
  고령화: ["고령", "노인", "노령", "어르신", "65세"],
  수질: ["수질", "물", "하천", "연안", "바다", "녹조", "적조"],
  주거: ["주거", "집값", "월세", "전세", "주택"],
};

/** 카드를 부르는 낱말: 이름(「청년 유출·정착」 → 청년 · 유출 · 정착)과 영역(「C 인구·지역소멸」 → 인구 · 지역소멸) */
function cardTerms(card: IssueCard) {
  const split = (s: string) => s.split(/[·\s/,]+/).filter((w) => w.length >= 2);
  const name = split(card.name);
  const domain = split(card.domain.replace(/^[A-Z]\s+/, ""));
  return { name, domain };
}

/**
 * 이름 낱말이 절반 이상 걸리거나, 이름 낱말 하나 + 영역 낱말이 함께 걸려야 그 이슈로 본다.
 * 「청년 주거비 부담」 처럼 「청년」 하나만 걸리면 청년 유출로 읽지 않는다(다른 이슈 후보로만)
 */
function match(text: string, card: IssueCard) {
  const t = norm(text);
  const hit = (word: string) =>
    (SYNONYMS[word] ?? [word]).some((w) => t.includes(norm(w))) || t.includes(norm(word));
  const { name, domain } = cardTerms(card);
  const [nameHits, domainHits] = [name.filter(hit).length, domain.filter(hit).length];
  return {
    score: nameHits * 2 + domainHits,
    sure: nameHits * 2 >= name.length || (nameHits >= 1 && domainHits >= 1),
  };
}

export type IssueReading = {
  /** 문장이 가리키는 이슈(없으면 목록에 없는 질문) */
  best?: IssueCard;
  /** 그다음으로 걸린 이슈들 — 「다른 이슈일 수도 있어요」 */
  others: IssueCard[];
};

export function readIssue(text: string, cards: IssueCard[]): IssueReading {
  const ranked = cards
    .map((card) => ({ card, ...match(text, card) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.card.available_kinds - a.card.available_kinds);
  const best = ranked.find((r) => r.sure)?.card;
  return {
    best,
    others: ranked
      .filter((r) => r.card !== best)
      .slice(0, 2)
      .map(({ card }) => card),
  };
}

/**
 * 새 이슈 후보 이름의 처음 값: 문장에서 지역 · 기간 말과 물음 꼬리를 뺀 나머지.
 * 「여수 청년 주거비 부담은 어떤가요?」 → 「청년 주거비 부담」
 */
export function candidateName(text: string, said?: string) {
  let s = text
    .replace(/(20\d\d)\s*년?\s*(?:[~\-–—]|부터|에서)\s*(20\d\d)\s*년?(까지)?/g, " ")
    .replace(/(?:최근|지난)\s*\d+\s*년(간|동안)?/g, " ")
    .replace(/20\d\d\s*년?/g, " ")
    .replace(/[?？!.。]/g, " ");
  if (said) {
    // 공백을 뺀 지명이라 글자 사이에 공백이 있어도 맞게 지운다
    const pattern = said.split("").join("\\s*");
    s = s.replace(new RegExp(`${pattern}(시|군|구)?(의|에서|에|은|는)?`, "g"), " ");
  }
  s = s.replace(/\s+(은|는|이|가|을|를|의|에|에서)(?=\s|$)/g, " ");
  const words = s.split(/\s+/).filter(Boolean);
  // 끝의 물음 말(어떻게 · 달라졌나 · 있나 …)은 이름이 아니다
  while (
    words.length &&
    /^(어떻게|어떤가요|어떤가|어때|있나|있나요|달라졌나|달라졌나요|변했나|변했나요|되나|되나요|어디로|왜|정말)/.test(
      words.at(-1) ?? "",
    )
  ) {
    words.pop();
  }
  return words
    .join(" ")
    .replace(/(은|는)$/, "")
    .trim();
}
