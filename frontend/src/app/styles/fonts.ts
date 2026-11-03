import { Gothic_A1, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";

// 본문은 한글 Pretendard + 영문 IA Latin(DESIGN.md 「한영 섞어 쓰기」). 굵기마다 size-adjust 가 달라 next/font 로는
// 만들 수 없어서 @font-face 를 직접 쓴다. Pretendard 는 글자 범위별로 잘린 파일이라 화면에 쓰인 글자의 파일만 받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./ia-latin.css";

// 그 밖의 채택 글꼴(Figma 「00 · 로고 · 글꼴」): 맞추지 않은 Gothic A1(영문뿐인 큰 글자), 워드마크 Source Serif 4,
// 작은 라벨 IBM Plex Mono. next/font 가 빌드 때 받아 같은 출처에서 내보내고, CSS 변수로만 노출한다
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
