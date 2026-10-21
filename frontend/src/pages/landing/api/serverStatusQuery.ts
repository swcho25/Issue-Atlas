import { queryOptions } from "@tanstack/react-query";

import { browserGet } from "@/shared/api";

import { serverStatusSchema } from "../model/schema";

export const SERVER_STATUS_PATH = "/actuator/health";

export const serverStatusQuery = queryOptions({
  queryKey: ["server-status"],
  queryFn: () => browserGet(SERVER_STATUS_PATH, serverStatusSchema),
  retry: false,
});
