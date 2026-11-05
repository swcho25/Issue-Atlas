// 질문 실행 부하 시험(S15P31C108-260). 두 시나리오를 함께 돌린다.
//   questions  QUESTION_VUS 명이 쉬지 않고 POST /v1/questions (문장화 = 가짜 engine 지연)
//   probe      PROBE_RPS 건/초로 가벼운 DB 조회 GET /v1/places(지역 목록) — 질문이 몰릴 때 다른 API 가 멈추는지 본다
// 실행은 README.md. BASE_URL 은 Docker 안에서 본 backend 주소.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:18080';
const PLACE = __ENV.PLACE_ID || 'kr-12130';
const CARD = __ENV.CARD_ID || 'C1';
const DURATION = __ENV.DURATION || '120s';

export const options = {
  scenarios: {
    questions: {
      executor: 'constant-vus',
      vus: Number(__ENV.QUESTION_VUS || 30),
      duration: DURATION,
      exec: 'question',
    },
    probe: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.PROBE_RPS || 5),
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 50,
      maxVUs: 400,
      exec: 'probe',
    },
  },
  // 결과를 보려는 것이라 실패로 멈추지 않는다
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const body = JSON.stringify({
  place_id: PLACE,
  card_id: CARD,
  period_start: '2023-01-01',
  period_end: '2026-01-01',
  raw_text: null,
});

/** CSRF(SPA): GET /v1/auth/csrf 로 XSRF-TOKEN 쿠키를 받고 같은 값을 X-XSRF-TOKEN 헤더로 보낸다. */
export function setup() {
  const res = http.get(`${BASE}/v1/auth/csrf`);
  const token = res.cookies['XSRF-TOKEN'] && res.cookies['XSRF-TOKEN'][0].value;
  if (!token) throw new Error(`CSRF 토큰 없음: ${res.status}`);
  return { token };
}

export function question(data) {
  const res = http.post(`${BASE}/v1/questions`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': data.token,
      Cookie: `XSRF-TOKEN=${data.token}`,
    },
    timeout: '120s',
    tags: { api: 'question' },
  });
  check(res, { 'question 201': (r) => r.status === 201 });
}

export function probe() {
  const res = http.get(`${BASE}/v1/places`, {
    timeout: '120s',
    tags: { api: 'probe' },
  });
  check(res, { 'probe 200': (r) => r.status === 200 });
}
