// CI가 Worker 응답과 공개된 커밋을 확인하는 감시 경로. 비밀 설정은 노출하지 않는다.
export async function GET(request: Request) {
  // 요청 URL을 읽어 정적 사전 생성을 피한다.
  void request.url;
  return Response.json(
    { status: "UP", revision: process.env.DEPLOYMENT_REVISION ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
