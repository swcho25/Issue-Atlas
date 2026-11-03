const sample = "Issue Atlas 여수시 2025년 청년 순유출 −2,262명 · PM2.5 13.6 Gwangju ABC";
const weights = [400, 500, 600, 700, 800, 900] as const;

// 한영 섞어 쓰기(DESIGN.md) 확인용. 굵기마다 위는 기본 글꼴(IA Latin + Pretendard), 아래는 영문까지 Pretendard
export function FontSamples() {
  return (
    <section className="mt-12">
      <h2 className="text-heading-20">글꼴</h2>
      <p className="mt-1 text-body-13 text-text-2">
        굵기마다 위 = 영문 IA Latin(Gothic A1 맞춤) + 한글 Pretendard, 아래 = 전부 Pretendard
      </p>
      <div className="mt-4 grid gap-5">
        {weights.map((weight) => (
          <div key={weight} className="grid grid-cols-[48px_1fr] items-baseline gap-x-4">
            <span className="font-mono text-caption-12 text-text-3">{weight}</span>
            <p className="text-heading-24" style={{ fontWeight: weight }}>
              {sample}
            </p>
            <span />
            <p
              className="text-heading-24 text-text-3"
              style={{ fontWeight: weight, fontFamily: '"Pretendard Variable"' }}
            >
              {sample}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
