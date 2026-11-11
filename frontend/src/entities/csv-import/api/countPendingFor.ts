import { z } from "zod";

import { href } from "@/shared/lib/url";
import { adminGet } from "@/shared/server";

// 목록 응답(contracts/csv-imports ImportPage)에서 건수만 읽는다
const totalSchema = z.object({ total: z.number().int() });

/** 반영 담당자가 이 사람인 반영 대기 CSV 업로드 수(서버 전용). 왼쪽 띠 알림 점 · 데이터 소스 「CSV 처리 필요」가 같이 쓴다 */
export const countPendingFor = (assigneeId: number) =>
  adminGet(
    href("/v1/admin/imports", { status: "pending", assignee_id: assigneeId, size: 1 }),
    totalSchema,
  ).then((p) => p.total);
