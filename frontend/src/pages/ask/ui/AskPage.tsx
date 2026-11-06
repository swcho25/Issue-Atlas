"use client";

import { useMutation, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, type PlaceBoundaries } from "@/shared/api";
import { MapView } from "@/shared/ui/map";

import { boundariesQuery, createQuestion, placeCardsQuery, placesQuery } from "../api/queries";
import {
  candidateName,
  type PeriodReading,
  type PlaceReading,
  readIssue,
  readPeriod,
  readPlace,
} from "../model/interpret";
import { DATA_YEARS, DEFAULT_PERIOD, type Period, yearsPeriod } from "../model/period";
import { isAnswerable } from "../model/schema";
import { CandidateDialog } from "./CandidateDialog";
import { type AskMode, QuestionBuilder } from "./QuestionBuilder";
import { RunBar } from "./RunBar";
import { RunningPanel } from "./RunningPanel";
import { SentenceBuilder } from "./SentenceBuilder";

/** 처음 고른 지역: MVP 시연 지역 여수시 */
const DEFAULT_PLACE = "kr-12130";
// 왼쪽 카드(왼쪽 24 + 폭 560)와 아래 유리 바에 가리지 않게 지도를 맞춘다(바뀌지 않는 값이라 밖에 둔다)
const MAP_PADDING = { top: 48, right: 48, bottom: 120, left: 24 + 560 + 48 };
// 지역마다 받은 경계에서 시군구 테두리만 모은다(함수가 그대로면 결과가 바뀔 때만 다시 모은다)
const sigunguOf = (results: UseQueryResult<PlaceBoundaries>[]) =>
  results.flatMap((r) => r.data?.features.filter((f) => f.properties.level === "sigungu") ?? []);
// 문장으로 질문의 기간 칩에서 고를 수 있는 것: 자료 범위 전체 + 해마다
const YEAR_PERIODS = [
  DEFAULT_PERIOD,
  ...Array.from({ length: DATA_YEARS.to - DATA_YEARS.from + 1 }, (_, i) =>
    yearsPeriod(DATA_YEARS.from + i, DATA_YEARS.from + i),
  ),
];

/** 보낸 문장과 그 문장에서 읽은 지역 · 기간(이슈는 그 지역의 카드 목록이 와야 읽는다) */
type Said = { text: string; place: PlaceReading; period: PeriodReading };

/**
 * 새 질문(/ask): 지역 · 기간 · 이슈를 고르거나(이슈 골라서) 문장으로 묻고(문장으로 질문) 실행하면 결과 화면으로 간다.
 * 로그인한 사람만 온다(AuthLayout). 쓰는 중에 세션이 끝나 API 가 401 이면 랜딩으로 보낸다. 지도는 결과 화면과 같은 MapView
 */
export function AskPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AskMode>("pick");
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  // undefined = 아직 안 고름(처음 값을 쓴다), null = 문장 칩에서 비움
  const [pickedPlace, setPickedPlace] = useState<string | null>();
  const [pickedCard, setPickedCard] = useState<string | null>();
  const [said, setSaid] = useState<Said | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useMutation({
    mutationFn: (input: Parameters<typeof createQuestion>[0]) => createQuestion(input),
    onSuccess: (created) => router.push(`/results/${created.run_id}`),
  });

  const places = useQuery(placesQuery());
  const placeId =
    pickedPlace === null
      ? undefined
      : (pickedPlace ??
        places.data?.find((p) => p.place_id === DEFAULT_PLACE)?.place_id ??
        places.data?.[0]?.place_id);
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

  // 고른 이슈가 이 지역 목록에 없으면: 이슈 골라서는 판단할 수 있는 첫 이슈, 문장으로는 문장이 가리키는 이슈
  const list = cards.data ?? [];
  const sentenceMode = mode === "sentence";
  const issue = sentenceMode && said ? readIssue(said.text, list) : undefined;
  const card =
    pickedCard === null
      ? undefined
      : (list.find((c) => c.card_id === pickedCard) ??
        (sentenceMode ? issue?.best : (list.find(isAnswerable) ?? list[0])));
  const placeList = places.data ?? [];
  const placeName = placeList.find((p) => p.place_id === placeId)?.name;
  const summary = [placeName, card?.name, period.short].filter(Boolean).join(" · ");

  const start = () => {
    if (!placeId || !card || run.isPending) return;
    abort.current = new AbortController();
    run.mutate({
      placeId,
      cardId: card.card_id,
      period,
      rawText: sentenceMode ? said?.text : null,
      signal: abort.current.signal,
    });
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
  const pickCard = (id: string | null) => {
    cancel();
    setPickedCard(id);
  };
  const clearOrPickPlace = (id: string | null) => {
    cancel();
    setPickedPlace(id);
  };
  const pickPeriod = (p: Period) => {
    cancel();
    setPeriod(p);
  };
  // 탭을 바꾸면 문장 칩에서 비운 칸은 처음 값으로 돌린다(이슈 골라서는 늘 무엇이든 골라져 있다)
  const changeMode = (next: AskMode) => {
    cancel();
    setMode(next);
    if (pickedPlace === null) setPickedPlace(undefined);
    if (pickedCard === null) setPickedCard(undefined);
  };

  // 문장을 보내면 지역 · 기간을 읽어 채운다. 지명이 없으면 지금 지역 그대로, 「광주」 처럼 여럿이면 비우고 고르게
  const ask = (text: string) => {
    cancel();
    const reading = { text, place: readPlace(text, placeList), period: readPeriod(text) };
    setSaid(reading);
    setPeriod(reading.period.period);
    if (reading.place.placeId) setPickedPlace(reading.place.placeId);
    else if (reading.place.options.length) setPickedPlace(null);
    setPickedCard(undefined);
  };

  const notes: string[] = [];
  if (said) {
    const { place: p, period: t } = said;
    if (!placeId && p.options.length) notes.push(`「${p.said}」의 어느 곳인지 골라 주세요.`);
    else if (!p.placeId && !p.options.length && placeName)
      notes.push(`문장에 지역이 없어서 지금 고른 지역(${placeName})으로 했어요.`);
    if (t.defaulted && period.id === DEFAULT_PERIOD.id)
      notes.push(`문장에 기간이 없어서 자료 범위 전체(${DEFAULT_PERIOD.short})로 채웠어요.`);
    if (t.clamped) notes.push(`자료는 ${DEFAULT_PERIOD.short} 만 있어서 그 안으로 줄였어요.`);
    if (cards.isSuccess && !card && pickedCard !== null)
      notes.push("목록에 맞는 이슈가 없어요. 새 이슈 후보로 만들 수 있어요.");
    notes.push("칩을 눌러 바꿀 수 있어요.");
  }
  const sentence = (
    <SentenceBuilder
      state={{
        text: said?.text,
        placeOptions: placeList,
        placeId,
        notes,
        period,
        periodOptions: YEAR_PERIODS.some((p) => p.id === period.id)
          ? YEAR_PERIODS
          : [...YEAR_PERIODS, period],
        periodTone: said?.period.defaulted && period.id === DEFAULT_PERIOD.id ? "filled" : "read",
        card,
        cards: list,
        others: (issue?.others ?? []).filter((c) => c.card_id !== card?.card_id),
        // 새 이슈 후보는 지역이 정해지고 맞는 이슈가 없을 때만(이슈를 찾았으면 칩 × 로 비우면 나온다)
        candidate:
          said && placeId && cards.isSuccess && !card
            ? candidateName(said.text, said.place.said) || said.text
            : undefined,
      }}
      onSubmit={ask}
      onPlace={clearOrPickPlace}
      onCard={pickCard}
      onPeriod={pickPeriod}
      onCandidate={setCandidate}
    />
  );

  return (
    <div className="relative h-full min-h-150 overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          boundaries={boundaries.data}
          choices={choices}
          globe
          onPick={pickPlace}
          padding={MAP_PADDING}
          className="size-full"
        />
      </div>
      <QuestionBuilder
        mode={mode}
        onMode={changeMode}
        sentence={sentence}
        places={placeList}
        placeId={placeId}
        onPlace={pickPlace}
        period={period}
        onPeriod={pickPeriod}
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
            summary={
              sentenceMode && !said ? "문장으로 물어보세요" : summary || "지역과 이슈를 골라 주세요"
            }
            disabled={!placeId || !card || (sentenceMode && !said)}
            error={run.isError ? "실행하지 못했어요. 잠시 뒤 다시 실행해 주세요" : undefined}
            onRun={start}
          />
        )}
      </div>
      {candidate !== null && (
        <CandidateDialog
          name={candidate}
          place={placeList.find((p) => p.place_id === placeId)}
          period={period}
          sentence={sentenceMode ? said?.text : undefined}
          onClose={() => setCandidate(null)}
        />
      )}
    </div>
  );
}
