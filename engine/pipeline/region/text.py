"""모델 · 규칙에 넣기 전 기사 본문 앞부분 정리.

빅카인즈 본문 앞 200자는 「제목 → 사진 설명 → 출처 표시(○○시 제공 · 연합뉴스 ·
/○○일보 DB) → 본문」 순서가 많다. 사진 설명의 지명(「여수의 한 어촌인이…」 · 여수시 제공)이
기사 주제처럼 읽혀 전국 기사를 여수로 붙이는 오답이 났다(2026-10-27 검수)
→ 앞부분(250자 이내)에 출처 표시가 있으면 그 앞의 사진 설명까지 지운다.
"""

import re

# 출처 표시. 「제공했다」「제공하는」 같은 동사는 빼고,
# 띄어쓰기 없이 본문이 붙는 「제공정부의」는 잡는다
_CREDIT = re.compile(
    # 빅카인즈는 줄바꿈을 「..」로 바꿔 넣는다
    r"/?\s*사진\s*제공[\s.]*=\s*[가-힣A-Za-z0-9·]{1,30}"
    r"|\[사진\s*=[^\]]{0,40}\]?"
    r"|\(?사진\s*=\s*[^)\]]{0,30}?제공\)?"
    r"|/?\s*[가-힣A-Za-z0-9·]{1,20}\s?제공"
    r"(?!했|하|해|된|되|받|할|한|을|를|이|으로|에|과|와|키|중|처|자|금|량|[\s.]*=)"
    r"|연합뉴스"
    r"|/\s*[가-힣]{1,10}\s?DB"
)
CAPTION_SPAN = 250
MIN_BODY = 30  # 지우고 남은 본문이 이보다 짧으면 출처 표시가 본문 뒤에 붙은 경우 → 지우지 않는다
_SPACE_DOT = re.compile(r"[\s.]+")  # 빅카인즈가 공백 · 마침표를 바꿔 넣는다


def strip_title(title: str, body: str) -> str:
    """빅카인즈 본문은 제목을 한 번 더 싣고 시작한다 → 떼어 낸다"""
    body, title = body or "", (title or "").strip()
    want = len(_SPACE_DOT.sub("", title))
    if not title or not _SPACE_DOT.sub("", body[: len(title) + 20]).startswith(
        _SPACE_DOT.sub("", title)
    ):
        return body
    i = 0  # 제목 글자 수만큼(공백 · 마침표 무시) 앞에서 건너뛴다
    while want and i < len(body):
        if not re.match(r"[\s.]", body[i]):
            want -= 1
        i += 1
    return body[i:].lstrip()


def body_text(title: str, body: str) -> str:
    """제목을 뗀 본문에서 앞부분의 사진 설명 + 출처 표시를 지운다"""
    text = strip_title(title, body)
    # 앞부분의 마지막 출처 표시까지 (설명이 두 줄인 경우)
    last = next(reversed(list(_CREDIT.finditer(text[:CAPTION_SPAN]))), None)
    rest = text[last.end() :].lstrip(" .·/") if last else text
    return rest if len(rest) >= MIN_BODY else text
