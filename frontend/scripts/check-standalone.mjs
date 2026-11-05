import { existsSync, readdirSync } from "node:fs";

const root = new URL("../.next/standalone/", import.meta.url);
if (!existsSync(new URL("frontend/server.js", root))) {
  throw new Error("Missing standalone server: build with ISSUEATLAS_EC2_BUILD=1");
}
// Next traces files outside src too; reject accidental secrets in deployment artifacts.
function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (/^(\.env|\.dev\.vars)/.test(entry.name) || /\.(pem|key)$/.test(entry.name)) {
      throw new Error("Secret-like file found in standalone output");
    }
    if (entry.isDirectory()) inspect(new URL(`${entry.name}/`, dir));
  }
}
inspect(root);
console.log("PASS: standalone server and artifact secret-file guard");
