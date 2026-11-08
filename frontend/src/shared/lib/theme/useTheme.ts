"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, type Theme } from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** 지금 테마의 출처는 <html data-theme> 하나다. 그 속성과 OS 설정이 바뀌면 onChange 를 부른다(React 밖 — 지도 · 장면 코드에서도) */
export function onThemeChange(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** 지금 테마. 고른 값이 없으면 OS 설정 */
export function currentTheme(): Theme {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function useTheme(): Theme {
  return useSyncExternalStore(onThemeChange, currentTheme, () => "light");
}

// 페이지 전체 테마를 바꾸고 다음 방문을 위해 기억한다(저장이 막힌 브라우저면 이번 방문에만)
export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 시크릿 창 등에서 저장이 막혀도 화면 전환은 된다
  }
}
