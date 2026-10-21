import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// FSD 구조 검사. `pnpm lint` 가 eslint 다음에 돌린다.
export default defineConfig([...fsd.configs.recommended]);
