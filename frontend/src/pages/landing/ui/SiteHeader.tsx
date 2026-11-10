"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { setTheme, useTheme } from "@/shared/lib/theme";
import { Icon } from "@/shared/ui/icon";
import { AtlasMark } from "@/shared/ui/logo";
import { Toggle } from "@/shared/ui/toggle";

import { useLoginDialog } from "../model/login-dialog";
import styles from "./LandingPage.module.css";

/**
 * 화면 테마 토글(켜짐 = 어두운 화면). 손잡이에 해 · 달을 그려 무엇을 바꾸는지 보인다.
 * 처음 그릴 때는 저장된 테마로 바로 놓고(밝음 → 어두움으로 미끄러지는 움직임 없이), 그 뒤 누를 때만 움직인다
 */
function ThemeSwitch() {
  const dark = useTheme() === "dark";
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Toggle
      checked={dark}
      onChange={(on) => setTheme(on ? "dark" : "light")}
      label="어두운 화면"
      knob={<Icon name={dark ? "moon" : "sun"} />}
      animate={ready}
    />
  );
}

/** 맨 위에선 심벌만, 조금이라도 내리면 워드마크가 심벌 뒤에서 튀어나온다. 오른쪽은 테마 토글 · 유리 「로그인」 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const login = useLoginDialog();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.site} ${scrolled ? styles.scrolled : ""} z-panel`}>
      <Link href="/" className={styles.brand} aria-label="Issue Atlas">
        {/* 어두운 화면의 밝은 로고는 CSS 가 로고 색을 바꿔 끼운다(밝은 지도 위에서는 그대로) */}
        <AtlasMark className={styles.mark} />
        <span className={styles.wm} aria-hidden="true">
          <span>Issue Atlas</span>
        </span>
      </Link>
      <div className={styles.actions}>
        <ThemeSwitch />
        <button
          type="button"
          className={styles.glassBtn}
          // 반사광이 커서를 따라온다
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
          }}
          onClick={(e) => login.open(e.currentTarget)}
        >
          로그인
        </button>
      </div>
    </header>
  );
}
