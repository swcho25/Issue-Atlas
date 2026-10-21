// Claude SessionStart(compact) 훅: 맥락이 압축된 뒤 현재 작업의 실행 계획 파일을 다시 알려 준다.
// stdout 이 그대로 에이전트 맥락에 들어간다. 출력은 몇 줄로 짧게 유지한다.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const branch = spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).stdout?.trim();

if (branch && branch !== "main" && branch !== "dev") {
  const plan = `docs/plans/active/${branch.replaceAll("/", "-")}.md`;
  if (existsSync(join(root, plan))) {
    console.log(`[하네스] 현재 브랜치 ${branch}. 이어 가기 전에 실행 계획 ${plan} 을 다시 읽고, 완료 조건과 「다음 할 일」 범위 안에서만 작업한다.`);
  } else {
    console.log(`[하네스] 현재 브랜치 ${branch} 에 실행 계획(${plan})이 없다. 범위를 사람에게 확인하고 진행한다.`);
  }
}
process.exit(0);
