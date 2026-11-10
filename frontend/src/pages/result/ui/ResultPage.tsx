import { Suspense } from "react";

import { getArgument } from "../api/getResult";
import { ResultCard } from "./ResultCard";
import { ResultMap } from "./ResultMap";
import { MapOverlays } from "./overlay/MapOverlays";

// /results/[id] — 04 · 결과 · 지도 먼저. id 는 백엔드 run_id(질문 실행 한 번 = 결과 하나).
// Cache Components: params · 데이터 읽기는 <Suspense> 안에서 한다(밖에서 읽으면 화면 전체가 막힌다).
// 서버는 논증 응답만 받아 카드를 바로 보내고, 지도 경계는 ResultMap 이 브라우저에서 받는다
export function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="relative h-full bg-bg-canvas">
      {/* 기다리는 동안 지도를 미리 만들지 않는다(만들면 진짜 지도가 한 번 더 만들어진다) */}
      <Suspense>
        <ResultContent params={params} />
      </Suspense>
    </main>
  );
}

async function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const argument = await getArgument(id);
  return (
    <ResultMap placeId={argument.question.place_id}>
      <ResultCard argument={argument} />
      <MapOverlays argument={argument} />
    </ResultMap>
  );
}
