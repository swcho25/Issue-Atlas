"""URL 검사: 금지 소스 호스트, 쿼리에 남은 API 키."""

from urllib.parse import unquote, urlsplit, urlunsplit

# 네이버·카카오는 저장·LLM 금지, 빅카인즈(kinds.or.kr)는 기업 계약 전까지 금지 (PRD v4.1 7.5)
FORBIDDEN_HOSTS = ("naver.com", "kakao.com", "kinds.or.kr", "bigkinds.or.kr")

# 키를 담는 쿼리 이름. 대소문자와 _ · - 는 무시하고 비교한다
SECRET_PARAMS = frozenset(
    {"apikey", "servicekey", "key", "authkey", "token", "accesstoken", "secret", "clientsecret"}
)

PLACEHOLDER = "<KEY>"


def is_forbidden_host(url: str) -> bool:
    host = urlsplit(url).hostname or ""
    return any(host == d or host.endswith("." + d) for d in FORBIDDEN_HOSTS)


def mask_secrets(url: str) -> str:
    """키 값을 <KEY> 로 바꾼 URL. 바꿀 것이 없으면 받은 문자열을 그대로 돌려준다."""
    parts = urlsplit(url)
    params = parts.query.split("&")
    masked = [_mask_param(p) for p in params]
    if masked == params:
        return url
    return urlunsplit(parts._replace(query="&".join(masked)))


def _mask_param(param: str) -> str:
    name, sep, value = param.partition("=")
    if not sep or _normalize(name) not in SECRET_PARAMS or unquote(value) in ("", PLACEHOLDER):
        return param
    return f"{name}={PLACEHOLDER}"


def _normalize(name: str) -> str:
    return name.lower().replace("_", "").replace("-", "")
