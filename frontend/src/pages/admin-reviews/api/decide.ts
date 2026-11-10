import { browserPost } from "@/shared/api";

import { type DecisionAction, type ReviewDetail, reviewSchema } from "../model/schema";

// 검수 처리(POST /v1/admin/reviews/{id}/decisions). 수정 번호(expected_revision)로 동시 처리를 막는다.
// 확정 · 수정은 상세에서 받은 지금 값 전체를 expected_value 로 보낸다(그 사이 값이 바뀌었으면 409)
export function decideReview(detail: ReviewDetail, action: DecisionAction, reason: string) {
  const { request, current_value, scope } = detail;
  return browserPost(
    `/v1/admin/reviews/${encodeURIComponent(request.review_id)}/decisions`,
    {
      expected_revision: request.revision,
      action,
      scope,
      reason: reason.trim(),
      ...(action === "confirm" || action === "correct" ? { expected_value: current_value } : {}),
    },
    reviewSchema,
  );
}
