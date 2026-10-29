-- 기사 본문 표 정리(S15P31C108-128). 기사는 C1 문서 칸으로 raw_record → normalized_record 에 들어가고
-- P2 정제(contracts/p2 v0.5)를 거친다. news_article(V0007)은 이제 채우는 곳도 읽는 곳도 없다.
-- V0007 은 개발 서버에 적용돼 있어 파일을 지우지 않고 여기서 지운다. 뷰가 표를 읽으므로 뷰부터 지운다.
DROP VIEW news_article_ready;
DROP TABLE news_article;
