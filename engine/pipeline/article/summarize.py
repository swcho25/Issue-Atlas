"""본문 요약. 요약 방식은 이름(버전)과 함께 결과에 남겨, 나중에 모델로 바꿔도 구분한다."""

import re
from collections.abc import Callable
from dataclasses import dataclass

# 마침표 · 물음표 · 느낌표(뒤따르는 따옴표 · 괄호 포함) 다음이 공백이나 줄 끝이면 문장 끝.
# "3.5%" 처럼 바로 뒤에 글자가 오는 점은 문장 끝이 아니다
SENTENCE = re.compile(r".+?[.!?][\"'”’)]*(?=\s|$)")
# 줄 첫머리의 기자 머리말: [언론사(지역)=기자명 기자] · (지역=통신사) 기자명 기자 =
# 마침표 없는 부제목 다음 줄에 오기도 해서 본문 맨 앞이 아니라 줄 첫머리에서 찾는다
DATELINE = re.compile(
    r"^[ \t]*(?:[\[【][^\]】\n]{0,40}=[^\]】\n]{0,20}(?:기자|특파원)[\]】]"
    r"|\([^)\n]{0,30}=[^)\n]{0,20}\)[^=\n]{0,20}(?:기자|특파원)[ \t]*=)[ \t]*",
    re.MULTILINE,
)


@dataclass(frozen=True)
class Summarizer:
    name: str
    run: Callable[[str], str | None]


def sentences(body: str) -> list[str]:
    # 줄마다 나눠 본다. 문장 부호로 끝나지 않는 줄(사진 설명 · 기자 이름)은 문장으로 세지 않는다
    return [m.group().strip() for line in body.splitlines() for m in SENTENCE.finditer(line)]


def _lead3(body: str) -> str | None:
    return " ".join(sentences(DATELINE.sub("", body, count=1))[:3]) or None


# 첫 버전: 기사 앞 3문장. 요약 모델(KPF-BERTSum 등)은 다음 이슈에서 이 자리에 넣는다
LEAD3 = Summarizer("lead3-0.1.0", _lead3)
