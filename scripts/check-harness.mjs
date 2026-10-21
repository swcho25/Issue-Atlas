// 하네스 자체 검사: scripts/ · .githooks/ 가 바뀌면 pnpm check 가 이 파일을 돌린다.
//   1) scripts/**/*.mjs 문법   2) .githooks/* 셸 문법   3) Claude 훅 스크립트가 어떤 입력에도 exit 0 인지
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 1) Node 스크립트 문법
for (const file of walk(join(root, "scripts")).filter((f) => f.endsWith(".mjs"))) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) failures.push(`문법 오류 ${relative(root, file)}\n${r.stderr.trim()}`);
}

// 2) git 훅 셸 문법. PowerShell 에서는 sh 가 PATH 에 없으므로 Git for Windows 의 sh 를 찾는다
const hooksDir = join(root, ".githooks");
const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
const sh = ["sh", join(programFiles, "Git", "usr", "bin", "sh.exe"), join(programFiles, "Git", "bin", "sh.exe")].find(
  (candidate) => (candidate === "sh" || existsSync(candidate)) && !spawnSync(candidate, ["-c", "exit 0"]).error,
);
let hooksChecked = false;
if (!sh) {
  console.log("[harness] sh 를 찾지 못해 .githooks 문법 검사를 건너뜀 (Git for Windows 설치 확인)");
} else {
  for (const file of walk(hooksDir)) {
    const r = spawnSync(sh, ["-n", file], { encoding: "utf8" });
    if (r.status !== 0) failures.push(`셸 문법 오류 ${relative(root, file)}\n${r.stderr.trim()}`);
  }
  hooksChecked = true;
}

// 3) Claude 훅은 빈 입력 · 엉뚱한 입력에도 작업을 막지 않아야 한다(exit 0)
const hookScripts = ["scripts/hooks/format-file.mjs", "scripts/hooks/plan-reminder.mjs"];
for (const script of hookScripts) {
  for (const input of ["", "{}", "not json", '{"tool_input":{"file_path":"없는/파일.ts"}}']) {
    const r = spawnSync(process.execPath, [join(root, script)], { input, encoding: "utf8", cwd: root });
    if (r.status !== 0) failures.push(`${script} 가 입력 ${JSON.stringify(input)} 에 exit ${r.status}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`[harness] ${f}`));
  process.exit(1);
}
console.log(
  `[harness] scripts 문법 · ${hooksChecked ? "git 훅 문법" : "(git 훅 문법 건너뜀)"} · Claude 훅 스모크 통과`,
);
