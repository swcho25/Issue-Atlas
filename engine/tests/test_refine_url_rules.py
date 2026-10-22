import json

import pytest

from pipeline.refine import refine_record


@pytest.mark.parametrize("raw_url", [None, ""])
def test_record_without_raw_url_or_file_name_is_held(passing_record, raw_url):
    out = refine_record({**passing_record, "raw_url": raw_url, "file_name": None})

    assert out["validation_status"] == "held"
    assert out["issues"] == [{"code": "MISSING_REQUIRED", "field": "raw_url|file_name"}]


# 네이버·카카오는 저장·LLM 금지, 빅카인즈는 기업 계약 전까지 금지 (PRD v4.1 7.5)
@pytest.mark.parametrize(
    "raw_url",
    [
        "https://openapi.naver.com/v1/search/news.json?query=여수",
        "https://n.news.naver.com/mnews/article/001/0012345678",
        "https://OpenAPI.Naver.com/v1/search/blog.json",
        "https://dapi.kakao.com/v2/search/web?query=여수",
        "https://tools.kinds.or.kr/search/news",
        "https://www.bigkinds.or.kr/v2/news/index.do",
    ],
)
def test_forbidden_source_is_held(passing_record, raw_url):
    out = refine_record({**passing_record, "raw_url": raw_url})

    assert out["validation_status"] == "held"
    assert out["issues"] == [{"code": "FORBIDDEN_SOURCE", "field": "raw_url"}]


@pytest.mark.parametrize(
    "raw_url",
    [
        "https://notnaver.com/news/1",
        "https://www.jnilbo.com/news/articleView.html?idxno=90000075297",
    ],
)
def test_lookalike_host_is_not_forbidden(passing_record, raw_url):
    out = refine_record({**passing_record, "raw_url": raw_url})

    assert out["issues"] == []


@pytest.mark.parametrize(
    ("raw_url", "masked", "secret"),
    [
        (
            "https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList&apiKey=ZmFrZS1rb3Npcy1rZXk=&orgId=101",
            "https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList&apiKey=<KEY>&orgId=101",
            "ZmFrZS1rb3Npcy1rZXk=",
        ),
        (
            "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList?serviceKey=Zx9%2Bq%3D%3D&returnType=json&addr=여수",
            "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList?serviceKey=<KEY>&returnType=json&addr=여수",
            "Zx9%2Bq%3D%3D",
        ),
        (
            "https://example.go.kr/api?APIKEY=abc123&page=1",
            "https://example.go.kr/api?APIKEY=<KEY>&page=1",
            "abc123",
        ),
    ],
)
def test_real_key_in_url_is_held_and_masked(passing_record, raw_url, masked, secret):
    out = refine_record({**passing_record, "raw_url": raw_url})

    assert out["validation_status"] == "held"
    assert out["issues"] == [{"code": "SECRET_IN_URL", "field": "raw_url"}]
    assert out["raw_url"] == masked
    assert secret not in json.dumps(out, ensure_ascii=False)


@pytest.mark.parametrize(
    "name", ["key", "authKey", "token", "access_token", "secret", "client-secret"]
)
def test_other_key_param_names_are_held(passing_record, name):
    out = refine_record({**passing_record, "raw_url": f"https://example.go.kr/api?{name}=s3cr3t"})

    assert out["issues"] == [{"code": "SECRET_IN_URL", "field": "raw_url"}]
    assert out["raw_url"] == f"https://example.go.kr/api?{name}=<KEY>"


@pytest.mark.parametrize(
    "raw_url",
    [
        "https://kosis.kr/openapi/x.do?apiKey=%3CKEY%3E&orgId=101",
        "https://kosis.kr/openapi/x.do?apiKey=&orgId=101",
        "https://www.jeonnam-gwangju.go.kr/fileDownload.do?fileKey=JG_0000000003%7C982&fileSn=1",
    ],
)
def test_placeholder_empty_or_unrelated_key_param_passes(passing_record, raw_url):
    out = refine_record({**passing_record, "raw_url": raw_url})

    assert out["issues"] == []
    assert out["raw_url"] == raw_url
