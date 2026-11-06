-- 내 질문: 로그인한 사람이 물은 질문에 묻는 사람을 남긴다. 로그인 없이 묻는 질문과 이 칸 전 질문은 null.
-- 다시 실행은 새 질문이 아니라 같은 질문의 새 실행(argument_run)이다
ALTER TABLE question ADD COLUMN asked_by bigint REFERENCES app_user (id);
CREATE INDEX idx_question_asked_by ON question (asked_by) WHERE asked_by IS NOT NULL;
