"use client";

import { useEffect, useRef } from "react";

import { drawStatue, loadStatue } from "../lib/statue";
import styles from "./LandingPage.module.css";

// WebP: 지구 q80 · 구름 q85 · 석상 q90(투명 무손실). 그려진 지구 기준 원본 JPG 와 PSNR 46 dB 이상(눈으로 구분 안 됨)
const IMAGES = {
  earth: "/landing/earth_8192.webp",
  clouds: "/landing/clouds_4096.webp",
  statue: "/landing/statue.webp",
};

/** 아틀라스 석상 · 지구 · 바닥 그림자 캔버스. 지구(three)는 이 화면에서만 쓰여 따로 불러온다 */
export function AtlasScene() {
  const shadowRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<HTMLCanvasElement>(null);
  const statueRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const shadow = shadowRef.current;
    const globe = globeRef.current;
    const statue = statueRef.current;
    const frame = statue?.parentElement;
    if (!shadow || !globe || !statue || !frame) return;

    const cancel = new AbortController();
    let stopGlobe: (() => void) | undefined;
    let source: HTMLCanvasElement | undefined;
    let refit = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
    // 가로 · 세로 화면이 바뀌거나 창 크기가 바뀌면 석상을 지구에 다시 맞춘다
    const redraw = () => source && drawStatue(frame, statue, shadow, source);
    const onResize = () => {
      cancelAnimationFrame(refit);
      refit = requestAnimationFrame(redraw);
    };
    window.addEventListener("resize", onResize);
    portrait.addEventListener("change", redraw);

    // 이미지나 WebGL 을 못 쓰면 그 부분만 비고, 글자와 버튼은 그대로 남는다
    loadStatue(IMAGES.statue)
      .then((s) => {
        if (cancel.signal.aborted) return;
        source = s;
        redraw();
      })
      .catch(() => undefined);
    import("../lib/globe")
      .then(({ startGlobe }) => startGlobe(globe, IMAGES, reduced, cancel.signal))
      .then((stop) => {
        if (cancel.signal.aborted) stop();
        else stopGlobe = stop;
      })
      .catch(() => undefined);

    return () => {
      cancel.abort();
      cancelAnimationFrame(refit);
      window.removeEventListener("resize", onResize);
      portrait.removeEventListener("change", redraw);
      stopGlobe?.();
    };
  }, []);

  return (
    <>
      <canvas ref={shadowRef} className={`${styles.at} ${styles.shadow}`} aria-hidden="true" />
      <canvas
        ref={globeRef}
        className={`${styles.at} ${styles.globe}`}
        role="img"
        aria-label="아틀라스 석상이 받쳐 든 지구가 천천히 자전해요. 끌어서 돌릴 수 있어요"
      />
      <canvas ref={statueRef} className={`${styles.at} ${styles.statue}`} aria-hidden="true" />
    </>
  );
}
