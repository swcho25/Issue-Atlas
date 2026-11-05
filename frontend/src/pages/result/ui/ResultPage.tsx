import { Suspense } from "react";

import { MapView } from "@/shared/ui/map";

import { getResult } from "../api/getResult";
import { ResultCard } from "./ResultCard";

// /results/[id] — 04 · 결과 · 지도 먼저. id 는 백엔드 run_id(질문 실행 한 번 = 결과 하나).
// Cache Components: params · 데이터 읽기는 <Suspense> 안에서 한다(밖에서 읽으면 화면 전체가 막힌다)
export function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="relative h-full">
      <Suspense fallback={<MapView className="h-full" />}>
        <ResultContent params={params} />
      </Suspense>
    </main>
  );
}

async function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { argument, boundaries } = await getResult(id);
  return (
    // 결과 카드(폭 400 + 왼쪽 24)가 덮는 쪽은 지도를 맞출 때 비워 둔다
    <MapView
      boundaries={boundaries}
      padding={{ top: 64, right: 64, bottom: 64, left: 488 }}
      className="h-full"
    >
      <ResultCard argument={argument} />
    </MapView>
  );
}
