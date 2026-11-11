// 사용자 여정 부하 시험(S15P31C108-340). 한 VU = 결과 화면까지 가는 사람 한 명.
//   MODE=journey(기본): 지역 목록 → 이슈 카드 → 질문 실행(POST) → 결과(논증 · 시공간 시리즈 · 기사) → 지도 경계
//                       → 시공간 관측 점 → 원문 탭 근거 상세 N개
//   MODE=read        : 시험 전에 결과 24개를 만들어 두고, VU 는 결과 화면(논증 → 지도 → 원문 탭)만 연다
// 질문은 매번 다른 (지역 · 카드 · 기간) 조합이라 문장화 캐시가 거의 맞지 않는다(처음 묻는 사람 기준).
// 실행은 README.md 「여정 시험」. BASE_URL 은 k6 컨테이너에서 본 backend 주소.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://atlas-journey-app:8080';
const MODE = __ENV.MODE || 'journey';
const PEAK = Number(__ENV.PEAK_VUS || 100);
const THINK = Number(__ENV.THINK_SECONDS || 1); // 화면 사이 생각 시간(초, 0.5~1.5배로 흔든다)
const EVIDENCE_PER_VISIT = Number(__ENV.EVIDENCE_PER_VISIT || 3);

// 12/1 범위: 시군구 6곳 × 공개 카드 C1 · A3, 2023-01 ~ 2025-12
const PLACES = ['kr-12130', 'kr-12210', 'kr-12240', 'kr-12270', 'kr-12300', 'kr-12330'];
const CARDS = ['C1', 'A3'];

// 단계 증가: 1 → 10 → 25 → 50 → 100명, 단계마다 오르기 + 머무르기. 합계 6분
const stages = (__ENV.STAGES || '').trim()
  ? JSON.parse(__ENV.STAGES)
  : [
      { duration: '15s', target: 1 },
      { duration: '15s', target: Math.round(PEAK * 0.1) },
      { duration: '45s', target: Math.round(PEAK * 0.1) },
      { duration: '15s', target: Math.round(PEAK * 0.25) },
      { duration: '60s', target: Math.round(PEAK * 0.25) },
      { duration: '15s', target: Math.round(PEAK * 0.5) },
      { duration: '60s', target: Math.round(PEAK * 0.5) },
      { duration: '15s', target: PEAK },
      { duration: '90s', target: PEAK },
      { duration: '30s', target: 0 },
    ];

export const options = {
  scenarios: {
    journey: { executor: 'ramping-vus', startVUs: 1, stages, gracefulRampDown: '60s', exec: 'journey' },
  },
  setupTimeout: '180s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max', 'count'],
  // 결과를 보려는 것이라 실패로 멈추지 않는다. 표시용 기준(데모 계획 목표: 조회 1초 · 질문 3초 + 문장화)
  thresholds: {
    'http_req_duration{api:question}': ['p(95)<15000'],
    'http_req_duration{api:argument}': ['p(95)<1000'],
    'http_req_duration{api:evidence}': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
};

const journeyTime = new Trend('journey_duration', true);
const runsDone = new Counter('runs_done');

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function think() {
  if (THINK > 0) sleep(THINK * (0.5 + Math.random()));
}

/** 2023-01 ~ 2025-12 안의 임의 기간(6~36개월, 달의 1일). 끝은 배타 */
function period() {
  const months = 6 + Math.floor(Math.random() * 31);
  const startIndex = Math.floor(Math.random() * (36 - months + 1));
  const ym = (i) => `${2023 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`;
  return { start: ym(startIndex), end: ym(startIndex + months) };
}

/** 근거 상세로 열 근거 ID: 논증 응답 data 의 네 묶음(통계 · 문서 · 기존 대응 · 분모)에서 */
function evidenceIds(argument) {
  const data = argument.data || {};
  const ids = [];
  for (const key of ['statistics', 'documents', 'existing_responses', 'denominators']) {
    for (const ref of data[key] || []) if (ref && ref.evidence_id) ids.push(ref.evidence_id);
  }
  return ids;
}

const get = (path, api) => http.get(`${BASE}${path}`, { tags: { api }, timeout: '120s' });

/** CSRF(SPA): GET /v1/auth/csrf 로 XSRF-TOKEN 쿠키를 받고 같은 값을 X-XSRF-TOKEN 헤더로 보낸다. VU 마다 한 번 */
let token = null;
function csrf() {
  if (token) return token;
  const res = http.get(`${BASE}/v1/auth/csrf`, { tags: { api: 'csrf' } });
  token = res.cookies['XSRF-TOKEN'] && res.cookies['XSRF-TOKEN'][0].value;
  return token;
}

function questionRequest(q, t, api) {
  return {
    method: 'POST',
    url: `${BASE}/v1/questions`,
    body: JSON.stringify({ place_id: q.place, card_id: q.card, period_start: q.start, period_end: q.end, raw_text: null }),
    params: {
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': t, Cookie: `XSRF-TOKEN=${t}` },
      tags: { api },
      timeout: '120s',
    },
  };
}

/** MODE=read: 지역 6 × 카드 2 × 기간 2 = 24개 결과를 미리 만든다 */
export function setup() {
  if (MODE !== 'read') return {};
  const t = csrf();
  const questions = [];
  for (const place of PLACES) {
    for (const card of CARDS) {
      questions.push({ place, card, start: '2023-01-01', end: '2026-01-01' });
      questions.push({ place, card, start: '2025-01-01', end: '2026-01-01' });
    }
  }
  const res = http.batch(questions.map((q) => questionRequest(q, t, 'setup')));
  const runs = questions.map((q, i) => ({ ...q, runId: res[i].status === 201 ? res[i].json('run_id') : null }));
  return { runs: runs.filter((q) => q.runId) };
}

/** 결과 화면: 논증(근거 수요표 · 논증 6칸 · 시공간 시리즈 · 기사, 서버 렌더링) → 지도(경계 · 관측 점) → 원문 탭 근거 상세 */
function view(q) {
  const result = get(`/v1/arguments/${q.runId}`, 'argument');
  if (!check(result, { 'argument 200': (r) => r.status === 200 })) return;
  runsDone.add(1);
  const argument = result.json();
  check(get(`/v1/places/${q.place}/boundaries`, 'boundaries'), { 'boundaries 200': (r) => r.status === 200 });
  check(
    get(`/v1/observations?place_id=${q.place}&card_id=${q.card}&period_start=${q.start}&period_end=${q.end}`, 'observations'),
    { 'observations 200': (r) => r.status === 200 },
  );
  think();
  // 원문 탭: 근거를 하나씩 눌러 읽는다(?e=evidence_id 마다 서버가 GET /v1/evidence/{id})
  for (const id of evidenceIds(argument).slice(0, EVIDENCE_PER_VISIT)) {
    check(get(`/v1/evidence/${id}`, 'evidence'), { 'evidence 200': (r) => r.status === 200 });
    think();
  }
}

export function journey(data) {
  const started = Date.now();
  if (MODE === 'read') {
    view(pick(data.runs));
    journeyTime.add(Date.now() - started);
    return;
  }
  const { start, end } = period();
  const q = { place: pick(PLACES), card: pick(CARDS), start, end };

  check(get('/v1/places', 'places'), { 'places 200': (r) => r.status === 200 });
  think();
  check(get(`/v1/places/${q.place}/cards?period_start=${start}&period_end=${end}`, 'cards'), {
    'cards 200': (r) => r.status === 200,
  });
  think();
  const r = questionRequest(q, csrf(), 'question');
  const asked = http.post(r.url, r.body, r.params);
  if (!check(asked, { 'question 201': (res) => res.status === 201 })) return;
  view({ ...q, runId: asked.json('run_id') });
  journeyTime.add(Date.now() - started);
}
