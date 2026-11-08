import { z } from "zod";

// GET /v1/admin/users 응답(contracts/c3 AdminUserPage). 계약상 활성 관리자(role=ADMIN, is_active=true)만 돌려준다
export const adminUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  is_active: z.boolean(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  page: z.number().int(),
  size: z.number().int(),
  total: z.number().int(),
});
