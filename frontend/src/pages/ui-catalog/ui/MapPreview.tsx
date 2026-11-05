"use client";

import { getVersion } from "maplibre-gl";
import { useEffect, useState } from "react";

import { ApiError, browserGet, type PlaceBoundaries, placeBoundariesSchema } from "@/shared/api";
import { MapView } from "@/shared/ui/map";

// 지도 바탕 견본(여수). 바탕 · 한국어 지명 · 경계 층은 MapView 가 그린다.
// 경계는 개발 서버가 붙은 백엔드의 GET /v1/places/kr-12130/boundaries(로컬 백엔드가 없으면 건너뜀)
export function MapPreview() {
  const [boundaries, setBoundaries] = useState<PlaceBoundaries>();
  const [status, setStatus] = useState("불러오는 중");

  useEffect(() => {
    browserGet("/v1/places/kr-12130/boundaries", placeBoundariesSchema)
      .then((b) => {
        setBoundaries(b);
        setStatus(`경계 ${b.features.length}개`);
      })
      .catch((e) => setStatus(`경계 없음(${e instanceof ApiError ? `API ${e.status}` : "오류"})`));
  }, []);

  return (
    <section className="mt-12">
      <h2 className="text-heading-20">지도 바탕</h2>
      <p className="mt-1 text-body-13 text-text-2">
        <code className="font-mono">
          {"<MapView boundaries={…} padding={…}>지도 위 부품</MapView>"}
        </code>
        {" · "}MapLibre {getVersion()} · OpenFreeMap positron · 한국어 지명 · 여수 · {status}
      </p>
      <MapView boundaries={boundaries} className="mt-4 h-[480px] rounded-xl shadow-card" />
    </section>
  );
}
