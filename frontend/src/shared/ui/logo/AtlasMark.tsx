"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { contour, LOGO_PATHS, rightAt, stepSpring, type SpringState } from "./contour";

type AtlasMarkProps = {
  /** true 면 오른쪽 면 윗날개가 스프링으로 펼쳐지며 안쪽 금색 면이 보인다 */
  open?: boolean;
  /** 채택 재질은 클레이. 평면은 아주 작은 크기·단색 인쇄용 */
  material?: "flat" | "clay";
  /** 어두운 바탕 위에서는 paper */
  tone?: "ink" | "paper";
  /** 24px 이하에서 쓰는 단순한 윤곽(얼굴 점 절반, 펼침 없음) */
  small?: boolean;
  className?: string;
};

const INK = {
  ink: {
    fill: "var(--logo-ink)",
    stops: ["--logo-clay-0", "--logo-clay-1", "--logo-clay-2"],
    mid: 0.46,
  },
  paper: {
    fill: "var(--logo-paper)",
    stops: ["--logo-clay-paper-0", "--logo-clay-paper-1", "--logo-clay-paper-2"],
    mid: 0.52,
  },
} as const;

function useSpring(target: number) {
  const [value, setValue] = useState(target);
  const state = useRef<SpringState>({ value: target, velocity: 0 });

  useEffect(() => {
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.current = { value: target, velocity: 0 };
      raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    let last = 0;
    const frame = (time: number) => {
      const dt = last ? (time - last) / 1000 : 1 / 60;
      last = time;
      state.current = stepSpring(state.current, target, dt);
      setValue(state.current.value);
      if (!state.current.settled) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return value;
}

/** Issue Atlas 심벌: 접힌 지도책 두 면 사이로 아틀라스 옆얼굴이 보인다. 명세는 docs/design/logo.md */
export function AtlasMark({
  open = false,
  material = "clay",
  tone = "ink",
  small = false,
  className,
}: AtlasMarkProps) {
  const progress = useSpring(open && !small ? 1 : 0);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rest = small ? LOGO_PATHS.smallRight : LOGO_PATHS.right;
  const left = small ? LOGO_PATHS.smallLeft : LOGO_PATHS.left;
  const front = useMemo(
    () => (progress === 0 || small ? rest : contour(rightAt(progress))),
    [progress, rest, small],
  );
  const clay = material === "clay";
  const ink = INK[tone];
  const fill = clay ? `url(#${id}-ink)` : ink.fill;

  return (
    <svg viewBox="0 0 566 530" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-ink`} x1="0" y1="0" x2=".85" y2="1">
          <stop style={{ stopColor: `var(${ink.stops[0]})` }} />
          <stop offset={ink.mid} style={{ stopColor: `var(${ink.stops[1]})` }} />
          <stop offset="1" style={{ stopColor: `var(${ink.stops[2]})` }} />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".8" y2="1">
          <stop style={{ stopColor: "var(--logo-gold-0)" }} />
          <stop offset=".65" style={{ stopColor: "var(--logo-gold-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-gold-2)" }} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow
            dx=".8"
            dy="2.2"
            stdDeviation="2"
            floodOpacity=".17"
            style={{ floodColor: "var(--logo-shadow)" }}
          />
        </filter>
        <clipPath id={`${id}-left`}>
          <path d={left} />
        </clipPath>
        <clipPath id={`${id}-right`}>
          <path d={front} />
        </clipPath>
      </defs>
      <g filter={clay ? `url(#${id}-shadow)` : undefined}>
        {progress > 0.00001 && !small && <path d={rest} fill={`url(#${id}-gold)`} />}
        <path d={front} style={{ fill }} />
        <path d={left} style={{ fill }} />
        {clay && (
          <g
            fill="none"
            strokeWidth="1.8"
            opacity=".17"
            style={{ stroke: "var(--logo-highlight)" }}
          >
            <path d={left} clipPath={`url(#${id}-left)`} />
            <path d={front} clipPath={`url(#${id}-right)`} />
          </g>
        )}
      </g>
    </svg>
  );
}
