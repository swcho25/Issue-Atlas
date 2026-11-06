// 개발용 목 API 서버. `pnpm --filter frontend mock:api` 로 띄우고, 개발 서버는 API_BASE_URL=http://localhost:4010 으로 붙인다.
// - GET /v1/arguments/{run_id}: 계약 예시(contracts/c2/examples/argument-*.json)의 run_id 면 그 예시를 답한다
// - GET /v1/evidence/{evidence_id}: 계약 예시(evidence-*.json)의 evidence_id 면 그 예시를 답한다
// - 그 밖의 요청(경계 · 지역 목록 · 로그인 …)은 MOCK_UPSTREAM(기본: dev 백엔드)으로 그대로 넘기고, 로그인 쿠키도 브라우저로 넘긴다
// Node 의 타입 지우기로 바로 실행한다(빌드 없음). 앱 코드가 아니라 배포에 들어가지 않는다
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
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
