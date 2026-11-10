import { z } from "zod";

// C2 계약(contracts/c2, 11/4 동결 c2-0.1) 중 새 질문 화면이 쓰는 응답

export const placeListSchema = z.object({
  places: z.array(
    z.object({
      place_id: z.string(),
      name: z.string(),
      level: z.enum(["sido", "sigungu", "emd", "station"]),
      parent_id: z.string().nullable(),
    }),
  ),
});
export type Place = z.infer<typeof placeListSchema>["places"][number];

export const evidenceKinds = [
  "statistics",
  "documents",
  "existing_responses",
  "denominators",
] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];

export const placeCardsSchema = z.object({
  cards: z.array(
    z.object({
      card_id: z.string(),
      name: z.string(),
      domain: z.string(),
      parent_question: z.string(),
      card_version: z.number(),
      evidence: z.array(
        z.object({
          kind: z.enum(evidenceKinds),
          status: z.enum([
            "available",
            "not_published",
            "not_collected",
            "license_blocked",
            "review_pending",
          ]),
        }),
      ),
      available_kinds: z.number(),
      review_pending_count: z.number(),
    }),
  ),
});
export type IssueCard = z.infer<typeof placeCardsSchema>["cards"][number];

/** 근거 4종 이름(근거 수요표와 같은 말) */
export const evidenceLabel: Record<EvidenceKind, string> = {
  statistics: "통계",
  documents: "문서",
  existing_responses: "기존 대응",
  denominators: "참고 지표",
};

/** 근거가 하나라도 있으면 판단할 수 있는 이슈로 묶는다. 없으면 실행해도 빈칸이 결과다 */
export const isAnswerable = (card: IssueCard) => card.available_kinds > 0;
