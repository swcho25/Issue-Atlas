const [base, revision] = process.argv.slice(2);
if (!base || !revision) throw new Error("Usage: node verify.mjs <base-url> <revision>");

let failure;
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    const headers = { "User-Agent": "IssueAtlasDeploymentCheck/1.0" };
    const health = await fetch(new URL("/healthz", base), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!health.ok) throw new Error(`Frontend health HTTP ${health.status}`);
    const state = await health.json();
    if (state.status !== "UP" || state.revision !== revision) {
      throw new Error("Published revision does not match this deployment");
    }
    const page = await fetch(new URL("/", base), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`Frontend page HTTP ${page.status}`);
    }
    await page.text();
    const api = await fetch(new URL("/api/actuator/health", base), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!api.ok || (await api.json()).status !== "UP") {
      throw new Error(`Backend proxy health HTTP ${api.status}`);
    }
    console.log("PASS: frontend revision, HTML page, and backend proxy health");
    process.exit(0);
  } catch (error) {
    failure = error;
    if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}
console.error(failure.message);
process.exit(1);
