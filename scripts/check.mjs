// 바뀐 영역만 검사한다. 실패하면 무엇이 틀렸는지와 고치는 명령을 함께 출력한다.
//   pnpm check        기준 브랜치(origin/develop, 없으면 origin/main) 이후 바뀐 파일 + 작업 트리 변경
//   pnpm check:all    전체 lint · typecheck · test · build · e2e (MR 전)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const all = process.argv.includes("--all");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
}

// node·git·docker 는 셸 없이 실행한다. Windows 의 .cmd(corepack 등)만 셸을 거치며,
// 이때는 공백·한글 경로를 따옴표로 감싼 한 줄 명령으로 넘긴다.
function exec(cmd, args) {
  if (!isWindows || cmd === process.execPath) return spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);
  return spawnSync([cmd, ...args].map(quote).join(" "), { cwd: root, stdio: "inherit", shell: true });
}

function git(args) {
  const r = run("git", ["-c", "core.quotepath=false", ...args]);
  return r.status === 0 ? r.stdout : null;
}

// pnpm 으로 실행되면 같은 pnpm 을, 아니면 corepack 을 거친다 (PATH 에 pnpm 이 없어도 되게).
function pnpmCommand(args) {
  const execPath = process.env.npm_execpath;
  if (execPath && /pnpm/i.test(execPath)) {
    return /\.[cm]?js$/.test(execPath) ? [process.execPath, [execPath, ...args]] : [execPath, args];
  }
  return ["corepack", ["pnpm", ...args]];
}

function changedFiles() {
  const base = ["origin/develop", "origin/main"].find((ref) => git(["rev-parse", "--verify", "--quiet", ref]) !== null);
  const files = new Set();
  if (base) {
    const mergeBase = git(["merge-base", base, "HEAD"])?.trim();
    if (mergeBase) git(["diff", "--name-only", "-z", mergeBase, "HEAD"])?.split("\0").forEach((f) => f && files.add(f));
  }
  // 커밋 전 변경(스테이지·미스테이지·추적 안 됨)
  const entries = git(["status", "--porcelain", "-z", "--untracked-files=all"])?.split("\0") ?? [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].length <= 3) continue;
    files.add(entries[i].slice(3));
    if (/^[RC]/.test(entries[i])) i++; // 이름 바꾸기·복사는 다음 항목이 원래 경로
  }
  return { base: base ?? "(기준 브랜치 없음)", files: [...files] };
}

const FRONTEND_ROOT_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];

function areasOf(files) {
  const areas = new Set();
  for (const f of files) {
    if (f.startsWith("frontend/") || FRONTEND_ROOT_FILES.includes(f)) areas.add("frontend");
    else if (f.startsWith("backend/") || f === "docker-compose.yml") areas.add("backend");
    else if (f.startsWith("contracts/")) areas.add("contracts");
    else if (f.startsWith("engine/")) areas.add("engine");
    else if (f.startsWith("scripts/") || f.startsWith(".githooks/")) areas.add("harness");
  }
  return areas;
}

const dockerHint = [
  "Docker 가 꺼져 있습니다. backend 테스트(Testcontainers)는 Docker 가 필요합니다.",
  "  Docker Desktop 을 켠 뒤 같은 명령을 다시 실행하세요",
];

const steps = {
  harness: {
    cmd: () => [process.execPath, [join(root, "scripts", "check-harness.mjs")]],
    fix: ["위 [harness] 줄의 파일을 고친 뒤      node scripts/check-harness.mjs"],
  },
  "frontend lint": {
    cmd: () => pnpmCommand(["--filter", "frontend", "lint"]),
    fix: [
      "포맷(prettier) 자동 수정  pnpm --filter frontend format",
      "ESLint 자동 수정          pnpm --filter frontend exec eslint --fix .",
      "FSD(steiger) 위반은 import 방향(app → pages → widgets → features → entities → shared)과",
      "슬라이스 public API(index.ts)를 확인          frontend/AGENTS.md",
    ],
  },
  "frontend typecheck": {
    cmd: () => pnpmCommand(["--filter", "frontend", "typecheck"]),
    fix: ["위 tsc 오류의 파일:줄을 고친 뒤      pnpm frontend:typecheck"],
  },
  "frontend test": {
    cmd: () => pnpmCommand(["--filter", "frontend", "test"]),
    fix: [
      "위 출력의 실패한 테스트 이름 · 기대값 · 실제값을 보고 고친 뒤      pnpm frontend:test",
      "한 파일만 반복 실행          pnpm --filter frontend exec vitest <파일 경로>",
    ],
  },
  "frontend e2e": {
    // next build 를 포함한다(빌드 검사를 겸함)
    cmd: () => pnpmCommand(["--filter", "frontend", "e2e"]),
    fix: [
      "실패 기록(trace)        frontend/test-results/ → pnpm --filter frontend exec playwright show-trace <trace.zip>",
      "브라우저가 없다는 오류면  pnpm --filter frontend exec playwright install chromium",
      "다시 실행              pnpm frontend:e2e",
    ],
  },
  "backend test": {
    needsDocker: true,
    cmd: () => [process.execPath, [join(root, "scripts", "gradle.mjs"), "test"]],
    fix: ["실패한 테스트 보고서   backend/build/reports/tests/test/index.html", "다시 실행             pnpm backend:test"],
  },
  "backend build": {
    needsDocker: true,
    cmd: () => [process.execPath, [join(root, "scripts", "gradle.mjs"), "build"]],
    fix: ["실패한 테스트 보고서   backend/build/reports/tests/test/index.html", "다시 실행             pnpm backend:build"],
  },
  "engine lint": {
    cmd: () => pnpmCommand(["engine:lint"]),
    fix: [
      "uv 가 없으면 설치          https://docs.astral.sh/uv/getting-started/installation/",
      "포맷(ruff) 자동 수정       uv --directory engine run ruff format .",
      "린트 자동 수정             uv --directory engine run ruff check --fix .",
    ],
  },
  "engine test": {
    cmd: () => pnpmCommand(["engine:test"]),
    fix: ["실패한 테스트만 다시      uv --directory engine run pytest --lf", "다시 실행                pnpm engine:test"],
  },
};

function plan() {
  if (all) return { label: "전체", names: ["harness", "frontend lint", "frontend typecheck", "frontend test", "frontend e2e", "backend build", "engine lint", "engine test"] };
  const { base, files } = changedFiles();
  const areas = areasOf(files);
  const names = [];
  if (areas.has("harness")) names.push("harness");
  if (areas.has("frontend")) names.push("frontend lint", "frontend typecheck", "frontend test");
  if (areas.has("backend")) names.push("backend test");
  if (areas.has("engine")) names.push("engine lint", "engine test");
  const notes = [];
  if (areas.has("contracts")) notes.push("contracts 변경: 검사기 없음. 받는 쪽(frontend·backend) 리뷰를 MR 에 요청하세요");
  return { label: `변경 영역 [${[...areas].join(", ") || "없음"}] · 기준 ${base} · 파일 ${files.length}개`, names, notes };
}

function dockerRunning() {
  return run("docker", ["info"], { stdio: "ignore" }).status === 0;
}

const { label, names, notes = [] } = plan();
console.log(`[check] ${label}`);
notes.forEach((n) => console.log(`[check] ${n}`));
if (names.length === 0) {
  console.log("[check] 검사할 코드 변경이 없습니다.");
  process.exit(0);
}

const results = [];
for (const name of names) {
  const step = steps[name];
  if (step.needsDocker && !dockerRunning()) {
    results.push({ name, ok: false, ms: 0, fix: dockerHint });
    break;
  }
  console.log(`\n[check] ▶ ${name}`);
  const started = Date.now();
  const [cmd, args] = step.cmd();
  const r = exec(cmd, args);
  const ok = r.status === 0;
  results.push({ name, ok, ms: Date.now() - started, fix: step.fix });
  if (!ok) break;
}

console.log("\n[check] 결과");
for (const { name, ok, ms } of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  ${(ms / 1000).toFixed(1)}s`);
const failed = results.find((r) => !r.ok);
if (failed) {
  console.error(`\n[FAIL] ${failed.name}`);
  failed.fix.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}
