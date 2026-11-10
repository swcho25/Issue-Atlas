"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { MapView } from "@/shared/ui/map";

import { boundariesQuery } from "../api/boundariesQuery";

// 결과 지도: 카드(children)는 서버에서 바로 오고, 경계는 브라우저에서 받아 도착하는 대로 그린다(캐시되면 바로)
export function ResultMap({ placeId, children }: { placeId: string; children: ReactNode }) {
  const { data: boundaries } = useQuery(boundariesQuery(placeId));
  return (
    // 결과 카드(폭 400 + 왼쪽 24)가 덮는 쪽은 지도를 맞출 때 비워 둔다
    <MapView
      boundaries={boundaries}
      padding={{ top: 64, right: 64, bottom: 64, left: 488 }}
      controls
      className="h-full"
    >
      {children}
    </MapView>
  );
}
