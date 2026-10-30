import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("wrangler.json", root), "utf8"));
const environment = process.env.WORKER_ENV ?? "development";
if (!["development", "production"].includes(environment)) throw new Error("Invalid WORKER_ENV");
const target = config.env[environment];
// OpenNext는 모노레포 루트의 .env도 번들에 넣는다. 비밀 파일을 읽기 전에 차단한다.
for (const dir of [root, new URL("../", root)]) {
  for (const mode of ["", ".production", ".development", ".test"]) {
    for (const suffix of ["", ".local"]) {
      if (existsSync(new URL(`.env${mode}${suffix}`, dir))) {
        throw new Error(
          "Workers 빌드는 .env 파일 없는 작업 디렉터리에서 실행하세요. 설정은 Wrangler vars/secrets를 사용합니다.",
        );
      }
    }
  }
}
// rewrites는 빌드 때 고정되므로 Workers 실행 설정과 같은 API 주소를 사용한다.
const cli = new URL("../cli/index.js", import.meta.resolve("@opennextjs/cloudflare"));
const result = spawnSync(process.execPath, [fileURLToPath(cli), "build", "--env", environment], {
  cwd: fileURLToPath(root),
  stdio: "inherit",
  env: {
    ...process.env,
    API_BASE_URL: target.vars.API_BASE_URL,
    ISSUEATLAS_WORKERS_BUILD: "1",
  },
});
process.exit(result.status ?? 1);
