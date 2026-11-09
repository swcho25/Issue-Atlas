"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { type ComponentProps, useEffect, useId, useRef, useState } from "react";

import { Icon, type IconName } from "../icon";

// Figma v5/Map controls(04 · 03 지도 오른쪽 아래): 폭 36 세로 묶음 · 사이 8.
//   확대 · 축소는 한 유리 판(36 × 73, 가운데 20 × 1 선 border-1), 위치는 따로(36 × 36). 모서리 8 · 아이콘 16 · text-1.
//   유리 채움은 Figma 「흰 10% 위 흰 40%」= 46%(glass 기본 38.8% · strong 50.5% 사이라 값을 직접 준다)
// 자리는 오른쪽 16 · 아래 40. Figma 는 아래 24 지만, 오른쪽 아래 끝(10)의 지도 출처 표시(펼치면 높이 24)와 겹쳐 16 올렸다(11/06 사용자 결정)
// 레이어 버튼은 맨 아래(36 × 36, 묶음 36 × 161)이고 「지도 레이어」 패널을 연다
const PANE = "flex flex-col overflow-hidden rounded-lg glass [--glass-fill:0.46]";

// glass 의 1px 선이 판 안쪽을 차지해(Figma 테두리는 안쪽) 버튼은 34 폭 · 확대 · 축소는 35 높이(1 + 35 + 선 1 + 35 + 1 = 73)
function ControlButton({
  icon,
  label,
  disabled,
  onClick,
  className,
  ...rest
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
} & Pick<ComponentProps<"button">, "ref" | "aria-expanded" | "aria-controls" | "aria-haspopup">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid w-full place-items-center text-text-1 outline-none hover:bg-glass-hover focus-visible:bg-glass-press disabled:pointer-events-none disabled:opacity-32 aria-expanded:bg-glass-press ${className}`}
      {...rest}
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

const limitsOf = (map: MapLibreMap) => ({
  min: map.getZoom() <= map.getMinZoom(),
  max: map.getZoom() >= map.getMaxZoom(),
});

/** 확대 수준이 끝에 닿으면 그쪽 버튼을 끈다 */
function useZoomLimits(map: MapLibreMap) {
  const [limits, setLimits] = useState(() => limitsOf(map));
  useEffect(() => {
    const update = () => setLimits(limitsOf(map));
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return limits;
}

/** 패널에서 켜고 끄는 지도 층 하나 */
export type MapLayerToggle = { id: string; label: string; on: boolean };

/**
 * 지도 확대 · 축소 · 위치(고른 지역으로 다시 맞추기) · 레이어. onLocate 가 없으면(경계가 아직 없으면) 위치 버튼을 끈다.
 * layers 를 넘기면 맨 아래에 레이어 버튼이 생기고, 누르면 그 위로 「지도 레이어」 패널이 열린다
 */
export function MapControls({
  map,
  onLocate,
  layers,
  onToggleLayer,
}: {
  map: MapLibreMap;
  onLocate?: () => void;
  layers?: MapLayerToggle[];
  onToggleLayer?: (id: string) => void;
}) {
  const { min, max } = useZoomLimits(map);
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // 열려 있으면 Esc(레이어 버튼으로 초점을 돌린다) · 묶음 바깥 누르기로 닫는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!group.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // 패널이 열려 있는 동안은 묶음을 팝오버 층으로 올린다. 같은 z-control 인 지도 위 부품(그림 시트 등)이 뒤에 그려져
  // 패널을 덮던 것(1600 폭에서 시트와 32 × 127 겹침)
  return (
    <div
      ref={group}
      role="group"
      aria-label="지도 조작"
      className={`absolute right-4 bottom-10 flex w-9 flex-col gap-2 ${open ? "z-popover" : "z-control"}`}
    >
      <div className={PANE}>
        <ControlButton
          icon="plus"
          label="확대"
          disabled={max}
          onClick={() => map.zoomIn()}
          className="h-[35px]"
        />
        <span aria-hidden className="mx-2 h-px bg-border-1" />
        <ControlButton
          icon="minus"
          label="축소"
          disabled={min}
          onClick={() => map.zoomOut()}
          className="h-[35px]"
        />
      </div>
      <div className={PANE}>
        <ControlButton
          icon="locate"
          label="고른 지역으로 돌아가기"
          disabled={!onLocate}
          onClick={() => onLocate?.()}
          className="h-[34px]"
        />
      </div>
      {layers && (
        <div className={PANE}>
          <ControlButton
            ref={trigger}
            icon="layers"
            label="지도 레이어"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((v) => !v)}
            className="h-[34px]"
          />
        </div>
      )}
      {layers && open && (
        <LayerPanel id={panelId} layers={layers} onToggle={(id) => onToggleLayer?.(id)} />
      )}
    </div>
  );
}

/**
 * 「지도 레이어」 유리 패널(Figma glass panel · 지도 레이어: 300 폭 · 모서리 20 · 흰 10% 위 흰 32% = glass 기본 · 안쪽 20,
 * 제목 Bold 15 · 줄 46 · 선 먹색 8%). 글자 15 는 토큰이 없어 제목 title-14 굵게 · 줄 body-14, 모서리 20 은 2xl(22).
 * 지도 버튼 묶음 바로 위(사이 8), 오른쪽을 맞춰 연다. 줄 전체가 스위치라 글자를 눌러도 켜고 끈다
 */
function LayerPanel({
  id,
  layers,
  onToggle,
}: {
  id: string;
  layers: MapLayerToggle[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label="지도 레이어"
      className="absolute right-0 bottom-full mb-2 w-[300px] rounded-2xl glass px-5 pt-5 pb-2"
    >
      <p className="text-title-14 font-bold text-text-1">지도 레이어</p>
      <ul className="mt-2">
        {layers.map((layer, i) => (
          <li key={layer.id} className={i ? "border-t border-text-1/8" : ""}>
            <button
              type="button"
              role="switch"
              aria-checked={layer.on}
              onClick={() => onToggle(layer.id)}
              className="group flex h-11.5 w-full items-center justify-between text-left text-body-14 text-text-1 outline-none"
            >
              {layer.label}
              <Toggle on={layer.on} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Figma Toggle(52 × 32): 켬 = 앰버 80% 렌즈(lens-amber), 끔 = 맑은 유리 트랙(toggle-track, 어두운 화면에서 빛을 낮춘다), 손잡이 28 흰색 · 그림자.
 * 초점은 줄(스위치)이 받고 테두리는 여기에 그린다
 */
function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-8 w-13 shrink-0 rounded-full group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-text-1 ${on ? "lens-amber" : "toggle-track"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-7 rounded-full bg-white shadow-md motion-safe:transition-transform ${on ? "translate-x-5" : ""}`}
      />
    </span>
  );
}
