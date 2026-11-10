-- 기사→카드 1차 분류 점수(V0035 document_card_score)에 선택 방식과 학습 분류기 확률을 더한다(S15P31C108-316).
--   method      : selected 를 정한 방식. cosine = 카드 프로필 코사인(V0035 그대로), f4 = 학습 분류기 확률
--   probability : f4 확률(0~1). cosine 행은 비워 둘 수 있다
-- 코사인(cosine_similarity)은 방식과 상관없이 계속 저장한다. 설정만 cosine 으로 돌리면 되돌릴 수 있게 하려는 것이다.
-- 기존 행은 모두 cosine 이 되고, 선택 검사는 V0035 와 같은 뜻으로 남는다.
ALTER TABLE document_card_score
    ADD COLUMN method text NOT NULL DEFAULT 'cosine'
        CONSTRAINT ck_document_card_score_method CHECK (method IN ('cosine', 'f4')),
    ADD COLUMN probability double precision
        CONSTRAINT ck_document_card_score_probability CHECK (probability BETWEEN 0 AND 1);

ALTER TABLE document_card_score DROP CONSTRAINT ck_document_card_score_selection;
ALTER TABLE document_card_score ADD CONSTRAINT ck_document_card_score_selection CHECK (
    (method = 'cosine' AND selected = (cosine_similarity >= threshold))
    OR (method = 'f4' AND probability IS NOT NULL AND selected = (probability >= threshold))
);
