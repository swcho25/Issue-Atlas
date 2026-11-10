import { adminGet } from "@/shared/server";

import { adminUserPageSchema } from "../model/schema";

/** 승인자 · 담당자로 고를 수 있는 활성 관리자(서버 전용) */
export const getAdmins = () =>
  adminGet("/v1/admin/users?size=100", adminUserPageSchema).then((p) => p.items);
