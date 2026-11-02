// contracts/cards(지표 사전 · C1 · A3)로 운영 seed SQL(backend/db/seed/cards-c1-a3.sql)을 만든다(S15P31C108-159).
// 카드 계약을 바꾸면 다시 돌린다. 결과가 계약과 같은지는 backend CardSeedIntegrationTest 가 본다.
//   node scripts/card-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARD_IDS = ["C1", "A3"];
// CardStorageService.saveDraft 가 초안에서 빼는 칸. 승인 때 서버와 지표 사전이 채운다
const NOT_IN_DRAFT = ["card_id", "card_version", "status", "taxonomy_version", "rule", "card_approval", "indicator_snapshots"];

// 숫자는 원문 그대로 둔다(3.0 이 3 으로 바뀌지 않게)
class Raw {
  constructor(text) {
    this.text = text;
  }
}
const read = (file) =>
  JSON.parse(readFileSync(join(root, "contracts", "cards", file), "utf8"), (_, value, ctx) =>
    typeof value === "number" ? new Raw(ctx.source) : value,
  );

const flat = (v) => {
  if (v instanceof Raw) return v.text;
  if (Array.isArray(v)) return `[${v.map(flat).join(", ")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${flat(x)}`).join(", ")}}`;
  return JSON.stringify(v);
};
// 짧으면 한 줄, 길면 한 단계씩 펼친다
const pretty = (v, pad, width = 110) => {
  const line = flat(v);
  const nested = v && typeof v === "object" && !(v instanceof Raw) && Object.keys(v).length > 0;
  if (!nested || line.length + pad.length <= width) return line;
  const inner = `${pad}  `;
  const items = Array.isArray(v)
    ? v.map((x) => inner + pretty(x, inner, width))
    : Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${pretty(x, inner, width)}`);
  const [open, close] = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
  return `${open}\n${items.join(",\n")}\n${pad}${close}`;
};
const jsonb = (v) => `$json$${pretty(v, " ".repeat(9))}$json$::jsonb`;
const text = (v) => (v == null ? "NULL::text" : `'${v}'`);

const cards = Object.fromEntries(CARD_IDS.map((id) => [id, read(`${id}.json`)]));
const indicators = read("indicators.json").indicators.map((row) => {
  const card = Object.values(cards).find((c) => c.rule.indicator_id === row.id);
  // 넣은 카드는 added_by_card, 그 칸이 없으면 쓰는 카드 첫째(CardDesignContractTest 와 같음)
  return { id: row.id, owner: row.added_by_card ?? row.cards[0] ?? null, definition: row, rule: card?.rule ?? null };
});
const drafts = CARD_IDS.map((id) => {
  const draft = Object.fromEntries(Object.entries(cards[id]).filter(([k]) => !NOT_IN_DRAFT.includes(k)));
  return { id, draft };
});

// 파생 지표(ratio · grade_days)는 분자 · 분모 · 기준 지표를 칸으로도 넣는다(C3 저장 트리거가 본다)
const indicatorRows = indicators
  .map((i) => {
    const deps = ["numerator_id", "denominator_id", "base_id"].map((k) => text(i.definition[k])).join(", ");
    return `        ('${i.id}', ${text(i.owner)}, ${deps},\n         ${jsonb(i.definition)},\n         ${i.rule ? jsonb(i.rule) : "NULL::jsonb"})`;
  })
  .join(",\n");
const cardRows = drafts.map((c) => `        ('${c.id}',\n         ${jsonb(c.draft)})`).join(",\n");

const sql = `-- 운영 지표 사전과 C1 · A3 카드 첫 승인(S15P31C108-159). Flyway 밖 — 개발 · 운영 DB 에 한 번씩 손으로 실행한다.
-- node scripts/card-seed.mjs 가 contracts/cards 로 만든 파일이다. 직접 고치지 않는다. CardSeedIntegrationTest 가 계약과 비교한다.
--   지표 definition · rule = indicators.json 행 · 카드 rule 그대로 · 카드 초안 = 카드 파일 − ${NOT_IN_DRAFT.join(" · ")}
-- 실행: psql "<DB 접속>" -v ON_ERROR_STOP=1 -c "SET issue_atlas.approver = '<관리자 로그인 이메일>'" -f backend/db/seed/cards-c1-a3.sql
-- DO 블록 하나라 실패하면 아무것도 남지 않는다. 다시 실행하면 이미 승인된 카드는 건너뛴다.
DO $seed$
DECLARE
    -- 관리자 API 로 승인할 때 남는 값(로그인 이메일)과 같게. 이메일은 저장소에 적지 않는다
    approver text := nullif(btrim(current_setting('issue_atlas.approver', true)), '');
    reason constant text := 'S15P31C108-159 운영 첫 승인. 기준: 대표 결정 2026-11-01(회사 노션 「2주 개발 플랜」 표 1 결정 2 · 3 · 4 · 5) '
        || '+ 세부 해석 2026-11-02(P5 최동준). 값: contracts/cards';
    i record;
    c record;
    rev bigint;
BEGIN
    IF approver IS NULL THEN
        RAISE EXCEPTION '승인자가 없다. SET issue_atlas.approver = ''<관리자 로그인 이메일>'' 을 먼저 실행한다';
    END IF;

    -- 지표 사전. 카드가 승인될 때 approve_card 가 그 카드가 넣은 지표를 verified 로 바꾼다
    FOR i IN SELECT * FROM (VALUES
${indicatorRows}
    ) AS v(indicator_id, added_by_card, numerator_id, denominator_id, base_id, definition, rule) LOOP
        IF NOT EXISTS (SELECT FROM indicator WHERE indicator_id = i.indicator_id) THEN
            INSERT INTO indicator(indicator_id, definition, rule, numerator_id, denominator_id, base_id,
                                  added_by_card, updated_by)
            VALUES (i.indicator_id, i.definition, i.rule, i.numerator_id, i.denominator_id, i.base_id,
                    i.added_by_card, approver);
        ELSIF EXISTS (SELECT FROM indicator WHERE indicator_id = i.indicator_id
                      AND (definition, rule, numerator_id, denominator_id, base_id, added_by_card)
                          IS DISTINCT FROM (i.definition, i.rule, i.numerator_id, i.denominator_id, i.base_id,
                                            i.added_by_card)) THEN
            RAISE EXCEPTION '지표 % 가 DB 와 seed 에서 다르다. 어느 쪽이 맞는지 확인한 뒤 다시 실행한다', i.indicator_id;
        END IF;
    END LOOP;

    -- legacy v1 다음인 v2 가 첫 승인본이다(C3)
    FOR c IN SELECT * FROM (VALUES
${cardRows}
    ) AS v(card_id, spec) LOOP
        IF (SELECT status FROM card WHERE card_id = c.card_id) = 'card' THEN
            RAISE NOTICE '% 는 이미 승인돼 건너뛴다', c.card_id;
            CONTINUE;
        END IF;
        UPDATE card SET draft_spec = c.spec || jsonb_build_object('author', approver),
                        draft_revision = draft_revision + 1, updated_by = approver, updated_at = now()
            WHERE card_id = c.card_id RETURNING draft_revision INTO rev;
        IF NOT FOUND THEN
            RAISE EXCEPTION '카드 % 가 없다(V0013)', c.card_id;
        END IF;
        PERFORM approve_card(c.card_id, approver, rev, reason);
    END LOOP;
END $seed$;
`;

const out = join(root, "backend", "db", "seed", "cards-c1-a3.sql");
writeFileSync(out, sql);
console.log(`[card-seed] ${out} (${sql.split("\n").length - 1}줄)`);
