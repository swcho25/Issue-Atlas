// Claude PostToolUse(Edit|Write) 훅: 방금 고친 파일 하나만 포맷한다.
// 실패해도 작업을 막지 않는다(항상 exit 0). 포맷 누락은 pnpm check 의 prettier --check 가 잡는다.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const frontend = join(root, "frontend");
const prettier = join(frontend, "node_modules", "prettier", "bin", "prettier.cjs");
const FORMATTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|css|json)$/;

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const file = input.tool_input?.file_path;
  const rel = file ? relative(frontend, file) : "";
  if (file && !rel.startsWith("..") && FORMATTABLE.test(file) && existsSync(prettier)) {
    // cwd 가 frontend 라 frontend/.prettierignore(생성물·문서 제외)를 따른다
    spawnSync(process.execPath, [prettier, "--write", "--ignore-unknown", rel], {
      cwd: frontend,
      stdio: "ignore",
      timeout: 10_000,
    });
  }
} catch {
  // 입력이 없거나 형식이 달라도 조용히 넘어간다
}
process.exit(0);
