"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./LandingPage.module.css";
import { ThemeImage } from "./ThemeImage";

// 실제 결과 화면(dev 데이터 · 여수시 청년 유출·정착)을 1600 × 900 으로 찍은 것. 어두운 화면에서는 같은 장면의 다크 캡처를 보인다
const SHOTS = [
  {
    title: "지도로 보기",
    text: "고른 지역 경계 위에서 해마다의 값과 판단을 함께 봐요",
    src: "/landing/tour-summary",
    alt: "여수시 청년 유출·정착 결과 — 왼쪽 카드에 근거 4종과 판단, 지도 위에 여수시 경계와 3년 순이동 막대",
  },
  {
    title: "근거와 판단",
    text: "분석 결과마다 근거 자료 · 해석 기준 · 다른 해석 가능성을 한 장에 붙여 둬요",
    src: "/landing/tour-argument",
    alt: "분석 근거 — 분석 결과 · 근거 자료 · 해석 기준 · 근거 수준 · 다른 해석 가능성 · 분석 범위 밖",
  },
  {
    title: "원문까지",
    text: "근거를 누르면 원문 위치와 각주가 열리고, 바로 복사돼요",
    src: "/landing/tour-sources",
    alt: "원문 탭 — 여수시 보도자료 근거의 원문 위치와 각주 복사 · 원문 사이트 열기",
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
          <ThemeImage
            key={s.src}
            className={i === current ? styles.on : ""}
            src={s.src}
            width={1600}
            height={900}
            alt={s.alt}
            hidden={i !== current}
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
