export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ia-theme";

// <head> 에서 화면을 그리기 전에 실행한다. 저장된 선택이 있으면 <html data-theme> 를 먼저 걸어 깜빡임을 막는다.
// 선택이 없으면 data-theme 을 두지 않아 OS 설정을 따른다(globals.css)
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
