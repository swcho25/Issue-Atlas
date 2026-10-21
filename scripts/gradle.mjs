// backend 의 Gradle Wrapper 를 운영체제에 맞게 실행한다.
// Windows 는 gradlew.bat, 그 밖은 ./gradlew. 루트 package.json 스크립트가 쓴다.
//   node scripts/gradle.mjs bootRun
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const isWindows = process.platform === "win32";
// Windows cmd 는 한글·공백 경로에서 상대 경로를 못 찾을 때가 있어 절대 경로를 따옴표로 감싼다.
const wrapper = isWindows ? `"${join(backendDir, "gradlew.bat")}"` : "./gradlew";

const result = spawnSync(wrapper, process.argv.slice(2), {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWindows,
});
process.exit(result.status ?? 1);
