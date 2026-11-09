// 개발용 목 API 서버. `pnpm --filter frontend mock:api` 로 띄우고, 개발 서버는 API_BASE_URL=http://localhost:4010 으로 붙인다.
// - GET /v1/arguments/{run_id}: 계약 예시(contracts/c2/examples/argument-*.json)의 run_id 면 그 예시를 답한다
// - GET /v1/evidence/{evidence_id}: 계약 예시(evidence-*.json)의 evidence_id 면 그 예시를 답한다
// - GET /v1/me/questions: 계약 예시(my-question-list.json). 회차의 결과는 실행 상태 · 판단이 같은 argument 예시로 답한다
// - POST /v1/questions/{question_id}/runs: 그 예시 질문에 새 회차를 붙인다(목 서버가 켜져 있는 동안만)
// - 그 밖의 요청(경계 · 지역 목록 · 로그인 …)은 MOCK_UPSTREAM(기본: dev 백엔드)으로 그대로 넘기고, 로그인 쿠키도 브라우저로 넘긴다
// Node 의 타입 지우기로 바로 실행한다(빌드 없음). 앱 코드가 아니라 배포에 들어가지 않는다
import { readdirSync, readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const UPSTREAM = process.env.MOCK_UPSTREAM ?? "https://dev.issue-atlas.kr/api";
const EXAMPLES = join(import.meta.dirname, "../../contracts/c2/examples");

// run_id → 예시 응답
const runs = new Map<string, { run_status: string; body: string }>();
for (const file of readdirSync(EXAMPLES).filter((f) => /^argument-.*\.json$/.test(f))) {
  const body = readFileSync(join(EXAMPLES, file), "utf8");
  const { run_id, run_status } = JSON.parse(body) as { run_id: string; run_status: string };
  runs.set(run_id, { run_status, body });
}

// evidence_id → 예시 응답(예시에 없는 근거는 dev 로 넘어가 404 가 된다)
const evidences = new Map<string, string>();
for (const file of readdirSync(EXAMPLES).filter((f) => /^evidence-.*\.json$/.test(f))) {
  const body = readFileSync(join(EXAMPLES, file), "utf8");
  evidences.set((JSON.parse(body) as { evidence_id: string }).evidence_id, body);
}

// 내 질문: 예시 목록을 메모리에 두고, 회차 run_id 는 실행 상태 · 판단이 같은 argument 예시를 빌려 답한다
type MockRun = { run_id: string; run_status: string; created_at: string; claim: string };
const mine = JSON.parse(readFileSync(join(EXAMPLES, "my-question-list.json"), "utf8")) as {
  questions: { question_id: string; candidate: boolean; runs: MockRun[] }[];
};
const borrow = (r: MockRun) => {
  for (const { body } of runs.values()) {
    const a = JSON.parse(body) as { run_status: string; claim: { value: string } };
    if (a.run_status === r.run_status && a.claim.value === r.claim) {
      runs.set(r.run_id, {
        run_status: r.run_status,
        body: JSON.stringify({ ...a, run_id: r.run_id }),
      });
      return;
    }
  }
};
mine.questions.flatMap((q) => q.runs).forEach(borrow);

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (req.method === "GET" && url.pathname === "/v1/me/questions") {
    json(res, 200, mine);
    console.info(`[mock] GET ${url.pathname} → 예시(${mine.questions.length}개)`);
    return;
  }
  const again = url.pathname.match(/^\/v1\/questions\/([^/]+)\/runs$/)?.[1];
  if (req.method === "POST" && again) {
    const q = mine.questions.find((x) => x.question_id === decodeURIComponent(again));
    if (!q || q.candidate) return json(res, 404, { status: 404, code: "RESOURCE_NOT_FOUND" });
    // 다시 실행은 판단한 결과(예시 ready)로 — 지난 회차와 나란히 비교된다
    const r = {
      ...q.runs[0],
      run_id: `run_mock_${Date.now()}`,
      run_status: "ready",
      claim: "increasing",
      created_at: new Date().toISOString(),
    };
    q.runs.unshift(r);
    borrow(r);
    json(res, 201, {
      schema_version: "c2-0.1",
      question_id: q.question_id,
      run_id: r.run_id,
      run_status: r.run_status,
      candidate: false,
    });
    console.info(`[mock] POST ${url.pathname} → 새 회차 ${r.run_id}`);
    return;
  }
  const run = url.pathname.match(/^\/v1\/arguments\/([^/]+)$/)?.[1];
  const mocked = req.method === "GET" && run ? runs.get(decodeURIComponent(run)) : undefined;
  if (mocked) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(mocked.body);
    console.info(`[mock] ${req.method} ${url.pathname} → 예시(${mocked.run_status})`);
    return;
  }
  const ev = url.pathname.match(/^\/v1\/evidence\/([^/]+)$/)?.[1];
  const evidence = req.method === "GET" && ev ? evidences.get(decodeURIComponent(ev)) : undefined;
  if (evidence) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(evidence);
    console.info(`[mock] ${req.method} ${url.pathname} → 근거 예시`);
    return;
  }
  // 나머지는 실제 백엔드로. fetch 가 압축을 풀어 주므로 content-encoding 은 빼고 돌려준다
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const hasBody = req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0;
    const headers: Record<string, string> = { accept: req.headers.accept ?? "application/json" };
    for (const name of ["content-type", "cookie", "x-xsrf-token"] as const) {
      const value = req.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    // 로그인 세션(JSESSIONID) · CSRF(XSRF-TOKEN) 쿠키를 브라우저(localhost)에 넘긴다. dev 도메인 · https 전용 표시는 떼어 localhost 에서도 붙게
    // (빠뜨리면 로그인 필수 화면을 목 서버로 볼 때 로그인 POST 가 CSRF 로 403, 세션도 안 남는다)
    const cookies = upstream.headers
      .getSetCookie()
      .map((c) => c.replace(/;\s*Domain=[^;]*/gi, "").replace(/;\s*Secure/gi, ""));
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      ...(cookies.length ? { "Set-Cookie": cookies } : {}),
    });
    res.end(body);
    console.info(`[mock] ${req.method} ${url.pathname} → ${UPSTREAM} ${upstream.status}`);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`목 서버가 ${UPSTREAM} 에 닿지 못했다: ${String(e)}`);
  }
});

server.listen(PORT, () => {
  console.info(`[mock] http://localhost:${PORT} (나머지 → ${UPSTREAM})`);
  for (const [id, { run_status }] of runs) console.info(`[mock]   /results/${id}  (${run_status})`);
});
