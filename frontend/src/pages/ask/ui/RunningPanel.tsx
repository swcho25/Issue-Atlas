import { Button } from "@/shared/ui/button";

import styles from "./RunningPanel.module.css";

/**
 * 실행 중(Figma 03 「실행 중」): 질문 하나는 서버에서 한 번에 돌아 중간 단계를 알 수 없다.
 * 그래서 단계를 지어내 채우지 않고, 흐르는 막대와 걸리는 시간만 알려 준다
 */
export function RunningPanel({ summary, onCancel }: { summary: string; onCancel: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-150 max-w-[calc(100vw-48px)] flex-col gap-4 rounded-2xl bg-surface-1 p-5 shadow-card"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-heading-20 text-text-1">근거를 모으고 있어요</span>
        <span className="truncate text-body-13 text-text-3">{summary}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div className={`h-full w-1/3 rounded-full bg-primary ${styles.flow}`} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption-12 text-text-2">
          보통 1분 안에 끝나요 · 끝나면 결과 화면으로 넘어가요
        </span>
        <Button variant="secondary" size="s" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
