import { API_BASE_URL } from "@/shared/config";

// Spring API 호출 공용 함수. 서버 컴포넌트·Route Handler 에서 쓴다.
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}
