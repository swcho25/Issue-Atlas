// 브라우저에 노출되지 않는 서버 전용 값. Next 서버(BFF)가 Spring API 를 부를 때 쓴다.
export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";
