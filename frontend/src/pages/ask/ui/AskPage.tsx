"use client";

import { useMutation, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, type PlaceBoundaries } from "@/shared/api";
import { MapView } from "@/shared/ui/map";

import { boundariesQuery, createQuestion, placeCardsQuery, placesQuery } from "../api/queries";
import { PERIODS } from "../model/period";
import { isAnswerable } from "../model/schema";
import { QuestionBuilder } from "./QuestionBuilder";
import { RunBar } from "./RunBar";
import { RunningPanel } from "./RunningPanel";

/** 처음 고른 지역: MVP 시연 지역 여수시 */
const DEFAULT_PLACE = "kr-12130";
// 왼쪽 카드(왼쪽 24 + 폭 560)와 아래 유리 바에 가리지 않게 지도를 맞춘다(바뀌지 않는 값이라 밖에 둔다)
const MAP_PADDING = { top: 48, right: 48, bottom: 120, left: 24 + 560 + 48 };
// 지역마다 받은 경계에서 시군구 테두리만 모은다(함수가 그대로면 결과가 바뀔 때만 다시 모은다)
const sigunguOf = (results: UseQueryResult<PlaceBoundaries>[]) =>
  results.flatMap((r) => r.data?.features.filter((f) => f.properties.level === "sigungu") ?? []);

/**
 * 새 질문(/ask): 지역 · 기간 · 이슈를 고르고 실행하면 결과 화면으로 간다.
 * 로그인한 사람만 온다(AuthLayout). 쓰는 중에 세션이 끝나 API 가 401 이면 랜딩으로 보낸다. 지도는 결과 화면과 같은 MapView
 */
export function AskPage() {
  const router = useRouter();
  const period = PERIODS[0];
  const [pickedPlace, setPickedPlace] = useState<string>();
  const [pickedCard, setPickedCard] = useState<string>();
  const abort = useRef<AbortController | null>(null);

  const run = useMutation({
    mutationFn: (input: Parameters<typeof createQuestion>[0]) => createQuestion(input),
    onSuccess: (created) => router.push(`/results/${created.run_id}`),
  });

  const places = useQuery(placesQuery());
  const placeId =
    pickedPlace ??
    places.data?.find((p) => p.place_id === DEFAULT_PLACE)?.place_id ??
    places.data?.[0]?.place_id;
  const cards = useQuery({ ...placeCardsQuery(placeId ?? "", period), enabled: !!placeId });
  const boundaries = useQuery({ ...boundariesQuery(placeId ?? ""), enabled: !!placeId });
  // 다른 지역 경계도 받아 두어 지도에서 눌러 고르게 한다(받아 둔 경계라 지역을 바꾸면 바로 그린다)
  const sigungu = useQueries({
    queries: (places.data ?? []).map((p) => boundariesQuery(p.place_id)),
    combine: sigunguOf,
  });
  const choices = useMemo(
    () => sigungu.filter((f) => f.properties.place_id !== placeId),
    [sigungu, placeId],
  );

  // 쓰는 중에 세션이 끝났으면(401) 랜딩으로 — 다시 로그인한다
  const expired = [places.error, cards.error, run.error].some(
    (e) => e instanceof ApiError && e.status === 401,
  );
  useEffect(() => {
    if (expired) router.replace("/");
  }, [expired, router]);

  // 고른 이슈가 이 지역 목록에 없으면 판단할 수 있는 첫 이슈를 고른 것으로 본다
  const list = cards.data ?? [];
  const card = list.find((c) => c.card_id === pickedCard) ?? list.find(isAnswerable) ?? list[0];
  const placeName = places.data?.find((p) => p.place_id === placeId)?.name;
  const summary = [placeName, card?.name, period.short].filter(Boolean).join(" · ");

  const start = () => {
    if (!placeId || !card || run.isPending) return;
    abort.current = new AbortController();
    run.mutate({ placeId, cardId: card.card_id, period, signal: abort.current.signal });
  };
  // 취소하면 요청을 끊고 상태를 처음으로 되돌린다(끊긴 요청의 실패는 화면에 오지 않는다)
  const cancel = () => {
    abort.current?.abort();
    run.reset();
  };
  // 실행 중에 지역 · 이슈를 바꾸면 그 질문은 끊는다. 끊지 않으면 앞 질문이 끝나는 대로 그 결과 화면으로 넘어간다.
  // 지역은 왼쪽 「지역」 칸으로 고르든 지도에서 누르든 같다
  const pickPlace = (id: string) => {
    cancel();
    setPickedPlace(id);
  };
  const pickCard = (id: string) => {
    cancel();
    setPickedCard(id);
  };

  return (
    <div className="relative h-full min-h-150 overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          boundaries={boundaries.data}
          choices={choices}
          onPick={pickPlace}
          padding={MAP_PADDING}
          className="size-full"
        />
      </div>
      <QuestionBuilder
        places={places.data ?? []}
        placeId={placeId}
        onPlace={pickPlace}
        period={period}
        cards={list}
        cardsState={
          cards.isError || places.isError ? "error" : cards.isSuccess ? "ready" : "loading"
        }
        selectedId={card?.card_id}
        onSelect={pickCard}
      />
      <div className="absolute bottom-8 left-[calc(584px+(100%-584px)/2)] -translate-x-1/2">
        {run.isPending ? (
          <RunningPanel summary={summary} onCancel={cancel} />
        ) : (
          <RunBar
            summary={summary || "지역과 이슈를 골라 주세요"}
            disabled={!placeId || !card}
            error={run.isError ? "실행하지 못했어요. 잠시 뒤 다시 실행해 주세요" : undefined}
            onRun={start}
          />
        )}
      </div>
    </div>
  );
}
