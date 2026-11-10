// 숫자 · 시각 표기. 시각은 서버 표기(Z · +00:00 · +09:00)가 달라도 같은 순간이면 같게 보이도록 한국 시간으로

/** 3,497,962 */
export const num = (n: number) => n.toLocaleString("ko-KR");

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString();

/** 2026-11-03 (날짜만 온 값은 그대로) */
export const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : kst(iso).slice(0, 10));
/** 2026-11-03 16:02 */
export const dateTime = (iso: string) => kst(iso).slice(0, 16).replace("T", " ");
/** 11-08 16:14 */
export const monthDayTime = (iso: string) => kst(iso).slice(5, 16).replace("T", " ");
/** 11-08 */
export const monthDay = (iso: string) => kst(iso).slice(5, 10);
