"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./LandingPage.module.css";

const SHOTS = [
  {
    title: "지도로 보기",
    text: "측정소와 기사가 놓인 지도에서 시점을 옮겨 가며 보세요",
    src: "/landing/screen-map.webp",
    alt: "광주 대기질 결과 — 측정소 점이 놓인 지도와 월별 막대",
  },
  {
    title: "근거와 판단",
    text: "근거 4종이 있는지 먼저 보고, 판단은 그다음에 확인해요",
    src: "/landing/screen-judge.webp",
    alt: "여수시 청년 유출 결과 — 왼쪽 카드에 근거 4종과 판단, 지도 위에 3년 순이동 막대",
  },
  {
    title: "원문까지",
    text: "점을 누르면 근거, 한 번 더 누르면 원문과 각주예요",
    src: "/landing/screen-source.webp",
    alt: "측정소를 누르면 열리는 상세 창 — 값의 근거 3건과 원문 · 각주 복사",
  },
];

/** 결과 화면 둘러보기: 칸을 누르면 그 화면으로. 화면이 보이는 동안만 막대가 차오르고(6초), 다 차면 다음 칸으로 넘어간다 */
export function Tour() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className={`${styles.tour} ${paused ? styles.paused : ""}`}>
      <div className={styles.screen}>
        {SHOTS.map((s, i) => (
          <Image
            key={s.src}
            className={i === current ? styles.on : undefined}
            src={s.src}
            width={1600}
            height={900}
            alt={s.alt}
            aria-hidden={i !== current}
          />
        ))}
      </div>
      <div className={styles.tabs} role="tablist" aria-label="결과 화면 둘러보기">
        {SHOTS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === current}
            className={`${styles.tab} ${i === current ? styles.on : ""}`}
            onClick={() => setCurrent(i)}
          >
            <span className={styles.bar}>
              <i onAnimationEnd={() => setCurrent((i + 1) % SHOTS.length)} />
            </span>
            <span className={styles.tabTitle}>{s.title}</span>
            <span className={styles.tabText}>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
