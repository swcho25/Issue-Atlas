import { Suspense } from "react";

import { getArgument } from "../api/getResult";
import { defaultMonth } from "../model/timeline";
import { openViews } from "../model/views";
import { ResultCard } from "./ResultCard";
import { ResultMap } from "./ResultMap";
import { MapOverlays } from "./overlay/MapOverlays";
import { ResultLoading } from "./state/ResultLoading";
import { ViewStateProvider } from "./viewState";

// /results/[id] — 04 · 결과 · 지도 먼저. id 는 백엔드 run_id(질문 실행 한 번 = 결과 하나).
// Cache Components: params · 데이터 읽기는 <Suspense> 안에서 한다(밖에서 읽으면 화면 전체가 막힌다).
// 서버는 논증 응답만 받아 카드를 바로 보내고, 지도 경계는 ResultMap 이 브라우저에서 받는다
export function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="relative h-full bg-bg-canvas">
      {/* 기다리는 동안 지도를 미리 만들지 않는다(만들면 진짜 지도가 한 번 더 만들어진다) — 카드 자리만 */}
      <Suspense fallback={<ResultLoading />}>
        <ResultContent params={params} />
      </Suspense>
    </main>
  );
}

async function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const argument = await getArgument(id);
  return (
    // 고른 유형 · 달은 지도 위 부품이 바꾸고 카드도 읽는다. 처음 값(판정에 쓰는 유형 · 값이 있는 마지막 달)은 여기서 정한다
    <ViewStateProvider
      initialView={openViews(argument).initial}
      initialMonth={defaultMonth(argument)}
    >
      <ResultMap placeId={argument.question.place_id}>
        <ResultCard argument={argument} />
        <MapOverlays argument={argument} />
      </ResultMap>
    </ViewStateProvider>
  );
}
