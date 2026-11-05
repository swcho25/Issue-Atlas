"use client";

import { useEffect, useRef } from "react";

import type { JourneyParts } from "../lib/journey";
import styles from "./LandingPage.module.css";

const isComplete = (p: { [K in keyof JourneyParts]: JourneyParts[K] | null }): p is JourneyParts =>
  Object.values(p).every(Boolean);

/** 히어로부터 서울 도착까지. 장면(three)은 이 화면에서만 쓰여 따로 불러온다 */
export function Journey() {
  const journey = useRef<HTMLElement>(null);
  const globe = useRef<HTMLCanvasElement>(null);
  const ground = useRef<HTMLCanvasElement>(null);
  const atlas = useRef<HTMLDivElement>(null);
  const statue = useRef<HTMLCanvasElement>(null);
  const shadow = useRef<HTMLCanvasElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const clouds = useRef<HTMLDivElement>(null);
  const fog = useRef<HTMLDivElement>(null);
  const wait = useRef<HTMLSpanElement>(null);
  const marks = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const attrib = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parts = {
      journey: journey.current,
      globe: globe.current,
      ground: ground.current,
      atlas: atlas.current,
      statue: statue.current,
      shadow: shadow.current,
      hero: hero.current,
      clouds: clouds.current,
      fog: fog.current,
      wait: wait.current,
      marks: marks.current,
      caption: caption.current,
      title: title.current,
      attrib: attrib.current,
    };
    if (!isComplete(parts)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stop: (() => void) | undefined;
    let cancelled = false;
    // WebGL · 그림을 못 쓰면 그 부분만 비고, 글자와 버튼은 그대로 남는다
    import("../lib/journey")
      .then(({ startJourney }) => {
        if (!cancelled) stop = startJourney(parts, reduced);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <section ref={journey} className={styles.journey}>
      <div className={styles.stage}>
        {/* 큰 이름은 맨 뒤에 둔다: 다가오는 지구가 글자를 덮고, 지도로 바뀌면 불투명한 지도가 덮는다 */}
        <div className={styles.frame}>
          <h1 className={`${styles.at} ${styles.mast}`}>Issue Atlas</h1>
        </div>
        <canvas ref={ground} className={`${styles.layer} ${styles.ground}`} aria-hidden="true" />
        <canvas
          ref={globe}
          className={`${styles.layer} ${styles.globe}`}
          role="img"
          aria-label="아틀라스가 받친 지구. 끌어서 돌릴 수 있어요"
        />
        {/* 석상 · 그림자는 히어로 글자와 따로 둔다: 스크롤하면 글자는 사라지고, 석상은 지구를 받친 채 함께 움직이고 커진다 */}
        <div ref={atlas} className={`${styles.frame} ${styles.atlas}`} aria-hidden="true">
          <canvas ref={shadow} className={`${styles.at} ${styles.shadow}`} />
          <canvas ref={statue} className={`${styles.at} ${styles.statue}`} />
        </div>
        <div ref={marks} className={`${styles.layer} ${styles.marks}`} aria-hidden="true" />
        <div ref={hero} className={styles.frame}>
          <div className={`${styles.at} ${styles.tag}`}>
            <h2 className={styles.lead}>지역의 문제를, 근거로 읽다.</h2>
            <p className={styles.sub}>공식 통계 · 보도자료로 연결하는 지역의 맥락</p>
            <svg className={styles.cue} viewBox="0 0 21 12" aria-hidden="true">
              <path
                d="M1.2 1.2 10.5 10.5 19.8 1.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div ref={clouds} className={`${styles.layer} ${styles.clouds}`} aria-hidden="true">
          <div className={styles.cloud} style={{ backgroundPosition: "30% 40%" }} />
          <div
            className={styles.cloud}
            style={{ backgroundPosition: "70% 55%", backgroundSize: "180% auto" }}
          />
          <div
            className={styles.cloud}
            style={{ backgroundPosition: "50% 30%", backgroundSize: "220% auto" }}
          />
        </div>
        <div ref={fog} className={styles.fog}>
          <span ref={wait} className={styles.wait}>
            지도를 불러오는 중
          </span>
        </div>
        <div ref={title} className={`${styles.at} ${styles.title}`}>
          <h2>
            어느 지역이든,
            <br />
            근거는 지도 위에 쌓여요
          </h2>
        </div>
        <div ref={caption} className={`${styles.at} ${styles.caption}`}>
          공식 통계 · 보도자료 · 정책 문서가 같은 지도 위에 모여요
        </div>
        <div ref={attrib} className={`${styles.at} ${styles.attrib}`}>
          지도 © OpenStreetMap, OpenFreeMap · 지형 Terrain Tiles(AWS)
        </div>
      </div>
    </section>
  );
}
