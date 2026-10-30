import { Gothic_A1, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";

// 채택 글꼴(Figma 「00 · 로고 · 글꼴」): 본문 Gothic A1, 워드마크 Source Serif 4, 작은 라벨 IBM Plex Mono.
// next/font 가 빌드 때 받아 같은 출처에서 내보낸다. CSS 변수로만 노출하고 globals.css 의 글꼴 토큰이 이어받는다.
// 한글은 글자 범위별로 잘린 파일 백여 개라 미리 받지 않는다(preload: false). 화면에 쓰인 글자의 파일만 받는다
const gothicA1 = Gothic_A1({
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-gothic-a1",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif-4",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});

export const fontVariables = [gothicA1.variable, sourceSerif4.variable, ibmPlexMono.variable].join(
  " ",
);
