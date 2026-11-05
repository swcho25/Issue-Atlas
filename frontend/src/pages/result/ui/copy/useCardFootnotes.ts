"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { EvidenceRef } from "@/shared/api";

import { evidenceQuery } from "../../api/evidenceQuery";
import { joinFootnotes } from "../../model/footnotes";

/**
 * 카드 각주 모으기: 근거마다 상세(각주)를 받아 한 줄씩 잇는다. 한 번 받은 근거는 캐시에서 꺼낸다.
 * 못 받은 근거는 목록 값(출처 · 자료명 · 기간 · 등급)으로 대신 써서, 하나가 실패해도 나머지는 복사된다
 */
export function useCardFootnotes(refs: EvidenceRef[]) {
  const client = useQueryClient();
  return useCallback(async () => {
    const footnotes = await Promise.all(
      refs.map((ref) =>
        client
          .fetchQuery(evidenceQuery(ref.evidence_id))
          .then((e) => e.footnote)
          .catch(() => null),
      ),
    );
    return joinFootnotes(refs, footnotes);
  }, [client, refs]);
}
