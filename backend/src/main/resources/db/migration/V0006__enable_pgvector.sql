-- pgvector 실행 파일은 PostGIS 기반 DB 이미지에 설치한다. 칼럼과 인덱스는 별도 마이그레이션에서 추가한다.
CREATE EXTENSION IF NOT EXISTS vector;
