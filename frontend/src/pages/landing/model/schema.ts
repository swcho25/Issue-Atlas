import { z } from "zod";

// Spring Actuator /actuator/health 응답. 필요한 필드만 검증하고 나머지는 무시한다.
export const serverStatusSchema = z.object({
  status: z.enum(["UP", "DOWN", "OUT_OF_SERVICE", "UNKNOWN"]),
});

export type ServerStatus = z.infer<typeof serverStatusSchema>;
