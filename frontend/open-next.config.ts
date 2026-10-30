import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 현재 화면에는 ISR/use cache 데이터가 없다. 영속 캐시 도입 시 별도 binding을 구성한다.
export default defineCloudflareConfig();
