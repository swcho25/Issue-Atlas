import { Button } from "@/shared/ui/button";

/**
 * 지도 아래 유리 바(Figma Glass/Question bar): 고른 「지역 · 이슈 · 기간」 + 질문 실행.
 * 실행하는 동안은 근거를 모으는 창으로 바뀐다(RunningPanel)
 */
export function RunBar({
  summary,
  disabled,
  error,
  onRun,
}: {
  summary: string;
  disabled: boolean;
  error?: string;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <p
          role="alert"
          className="rounded-full bg-surface-1 px-3 py-1 text-label-12 text-status-red shadow-xs"
        >
          {error}
        </p>
      )}
      <div className="flex h-14 items-center gap-3 rounded-full glass py-2.5 pr-2.5 pl-5.5 glass-thin">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        <span className="text-title-14 font-semibold whitespace-nowrap text-text-1">{summary}</span>
        <Button onClick={onRun} disabled={disabled}>
          질문 실행
        </Button>
      </div>
    </div>
  );
}
