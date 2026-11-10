import type { JobStatus, Source } from "@/shared/api";
import type { StatusTone } from "@/shared/ui/badge";

import type { ImportStatus } from "./schema";

// 데이터 소스 화면 글자(관제 · 데이터 포털에서 쓰는 말). running 은 끝 기록이 없다는 뜻일 뿐 수집이 살아 있다는 보장이 아니어서
// 「진행 중」이 아니라 「종료 미확인」(contracts/operations). CSV 는 API 가 업무 DB 를 바꾸지 않고 반영 담당자가 따로 넣는다

export const jobBadge: Record<JobStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: "green", label: "성공" },
  failed: { tone: "red", label: "실패" },
  aborted: { tone: "amber", label: "중단" },
  running: { tone: "blue", label: "종료 미확인" },
};

export const importBadge: Record<ImportStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: "amber", label: "반영 대기" },
  validation_failed: { tone: "red", label: "검증 오류" },
  no_changes: { tone: "gray", label: "변경 없음" },
  completed: { tone: "green", label: "반영 완료" },
  failed: { tone: "red", label: "반영 실패" },
};

export const storageLabel: Record<Source["storage_scope"], string> = {
  full: "원문 저장",
  metadata: "메타데이터만",
  link_only: "링크만",
};

export const methodLabel: Record<Source["specs"][number]["method"], string> = {
  api: "API",
  file: "파일",
  board: "게시판",
  rss: "RSS",
};

/** CSV 검증 오류 코드(backend CsvValidator). 모르는 코드는 그대로 */
const ERROR: Record<string, string> = {
  required: "빈칸",
  too_long: "너무 김",
  invalid_text: "쓸 수 없는 글자",
  spreadsheet_formula: "수식 시작 문자(= + - @)",
  invalid_kind: "data_kind 값",
  invalid_number: "숫자 형식",
  invalid_period: "기간 형식 · 순서",
  invalid_url: "URL 형식",
  invalid_missing_reason: "missing_reason 값",
  value_or_missing_reason: "value · missing_reason 중 하나만",
  document_field_must_be_empty: "문서는 비워야 하는 칸",
  unknown_reference: "없는 ID",
  unknown_or_repeated_reference: "없는 ID · 반복",
  source_mismatch: "출처와 명세가 맞지 않음",
  header_mismatch: "머리 줄이 양식과 다름",
  column_count: "칸 수가 다름",
  malformed_csv: "CSV 문법",
  empty_data: "자료 행 없음",
  too_many_rows: "행이 너무 많음",
};
export const errorLabel = (code: string) => ERROR[code] ?? code;
