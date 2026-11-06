"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "../icon";

// Figma v5/Map controls(04 · 03 지도 오른쪽 아래): 폭 36 세로 묶음 · 사이 8.
//   확대 · 축소는 한 유리 판(36 × 73, 가운데 20 × 1 선 border-1), 위치는 따로(36 × 36). 모서리 8 · 아이콘 16 · text-1.
//   유리 채움은 Figma 「흰 10% 위 흰 40%」= 46%(glass 기본 38.8% · strong 50.5% 사이라 값을 직접 준다)
// 자리는 오른쪽 16 · 아래 40. Figma 는 아래 24 지만, 오른쪽 아래 끝(10)의 지도 출처 표시(펼치면 높이 24)와 겹쳐 16 올렸다(11/06 사용자 결정)
// 레이어 버튼(지도 레이어 패널)은 패널을 만들 때 더한다
const PANE = "flex flex-col overflow-hidden rounded-lg glass [--glass-fill:0.46]";

// glass 의 1px 선이 판 안쪽을 차지해(Figma 테두리는 안쪽) 버튼은 34 폭 · 확대 · 축소는 35 높이(1 + 35 + 선 1 + 35 + 1 = 73)
function ControlButton({
  icon,
  label,
  disabled,
  onClick,
  className,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid w-full place-items-center text-text-1 outline-none hover:bg-white/30 focus-visible:bg-white/50 disabled:pointer-events-none disabled:opacity-32 ${className}`}
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

/** 지도 확대 · 축소 · 위치(고른 지역으로 다시 맞추기). onLocate 가 없으면(경계가 아직 없으면) 위치 버튼을 끈다 */
export function MapControls({ map, onLocate }: { map: MapLibreMap; onLocate?: () => void }) {
  const { min, max } = useZoomLimits(map);
  return (
    <div
      role="group"
      aria-label="지도 조작"
      className="absolute right-4 bottom-10 z-control flex w-9 flex-col gap-2"
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
    </div>
  );
}
