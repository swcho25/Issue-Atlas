"""기사 지역 질문(프롬프트 p9.1)과 답 확인. p3-region-lab region_lab/models/llm.py 에서 옮겼다.

LLM 은 「글에 나온 지명 + 대표 지역 고르기」만 하고, 이름 확인은 지명 사전(places)이 한다.
사전에 없는 시군구를 내면 NAT(환각 방지), 다시 물어도 JSON 이 아니면 「보류」.
시험 세트 시군구 정확도(Qwen2.5-32B-AWQ): bk_dev 96.3 · bk_test 100 · bk_test2 100 ·
덤프 표본 97.5%.
프롬프트가 고쳐진 까닭(p2 ~ p9.1)은 lab 의 llm.py 머리말에 있다.

주소 API(JUSO)로 장소를 확인하는 단계는 여기 없다 — 키를 수집기 한 곳에 두려고
적재(region-load)로 옮긴다
(MR 2b). 그 전까지는 장소 없이 확인한다: 통합시 전체 답을 장소로 좁히지 않고(p8.2),
글에 구 이름이 없는
광주 구 답은 광주권으로 둔다(notes 구추측에 LLM 답을 남겨 나중에 장소로 되살릴 수 있다).
재질문 덧붙임(2026-11-02): 잘린 JSON 이면 mentions 뿐 아니라 places 개수도 묶는다 —
시도지사 일정 모음
기사가 places 를 수십 개 늘어놓다 max_tokens 에서 잘렸다(04100078.20251202064952001).
"""

import re

from .labels import SIDO_SHORT, join_region
from .llm import parse_json
from .places import load, not_a_place
from .text import body_text

PROMPT_VERSION = "p9.1"
MAX_TOKENS = 500
BODY_CHARS = 1200

SYSTEM = """너는 한국 뉴스가 「어느 지역 이야기인지」 하나로 정하는 분류기다.

우리 지역 = 전남광주통합특별시(2026-07 출범). 아래 27곳이 전부다.
광주 5개 구: 광주 동구, 광주 서구, 광주 남구, 광주 북구, 광주 광산구
전남 22개 시군: 목포시, 여수시, 순천시, 나주시, 광양시, 담양군, 곡성군, 구례군, 고흥군, 보성군, 화순군, 장흥군, 강진군, 해남군, 영암군, 무안군, 함평군, 영광군, 장성군, 완도군, 진도군, 신안군

답은 지역을 시도(sido) · 시군(sigun) · 구(gu) 세 칸으로 나눈다. 정해지지 않는 칸은 "".
1. 주인공이 위 27곳 중 한 곳 — sido "전남광주통합특별시", sigun 은 시 · 군 이름("여수시", "영광군"), gu "".
   광주 5개 구는 sigun "광주", gu 에 구 이름("광산구")
2. 광주 이야기인데 글에 구 이름이 없다 — sigun "광주", gu "". 기관 이름(조선대·광주대·챔피언스필드 등)으로 구를 추측하지 않는다
3. 통합특별시 전체(sigun "") — 글의 주인공이 통합특별시 전체일 때만: 특별시청·특별시의회·교육청이 시·군 전체를 대상으로 하는 정책·예산,
   또는 위 27곳 중 3곳 이상을 고르게 다루는 글.
   「전남광주」라는 단어, 이름에 「광주」가 든 기관(광주○○공사 · 광주시○○연맹 · 광주○○회의소 → sigun "광주"),
   지역 신문 기사라는 사실만으로는 통합특별시 전체가 아니다. 한 시군구의 일이면 그 시군구다.
   orgs 에 정부 부처 · 통합특별시장이 들어 있어도 일이 광주 한 곳에서 벌어지면(광주 군공항 · 비행단 · 광주에 생기는 국가기관) sigun "광주"
4. 주인공 지역이 위 27곳 밖 한 시도 — sido 에 그 시도 줄임말, sigun · gu 는 "".
   시도 줄임말은 이 15개 중 하나: 서울, 부산, 대구, 인천, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 경북, 경남, 제주.
   광역시 · 특별자치시는 그 자체가 시도다: 울산 남구 "울산"(경남 아님), 대구 북구·군위 "대구"(경북 아님), 세종시 "세종"(충남 아님), 대전 대덕구 "대전".
   예: 서천·천안·공주 "충남", 제천·청주·오송 "충북", 영월·평창 "강원", 해운대 "부산", 성동구 "서울", 완주·남원·군산 "전북", 포항·안동 "경북", 창원·김해 "경남".
   그 시도의 기관 · 단체 · 대학(○○문화재단 · ○○시당 · ○○대학교)이 주인공이어도 그 시도다. 사설 · 칼럼도 한 시도 이야기면 그 시도.
   경기 광주시(박관열 시장·도척면·퇴촌면)는 "경기". 광주 군공항·광주기지는 우리 광주다
5. 특정 지역이 없는 글 — sido "전국". 「전국」은 어느 한 시도의 이야기도 아닐 때만 쓴다(다른 시도 한 곳의 이야기는 4번). 전국 날씨·태풍(기상청이 발표해도, 광주·여수 기온이 들어 있어도 서울·제주 등 전국을 다루면 전국.
   「광주·전남 날씨」처럼 우리 지역만 다루는 날씨는 통합특별시 전체), 국회·정당·대통령·정부 부처, 증시·환율·금융, 해외, 연예, 스포츠 일반,
   칼럼, 운세, 연재소설, 부고(장례식장이 우리 지역이어도 전국, places 도 []). 지역 신문에 실렸어도 내용이 전국이면 전국

단서가 아닌 것: 매체 이름, 「전남광주=○○ 기자」 같은 기자 소속, 사진 설명에만 나온 지명, 사람 이름 속 글자(거브러여수스), 부고·결혼의 장소.
제목과 첫 문장의 지역이 주인공이다. 본문에 잠깐 나온 지역은 주인공이 아니다.

emd: 그 시 · 군 · 구 안의 읍·면·동 이름이 글에 그대로 있을 때만(예: "벌교읍", "지죽동"). 없으면 "".

places: 일이 실제로 일어난 곳, 또는 글이 다루는 시설 그 자체 — 이름 있는 시설·건물·학교·병원·역·공원·항만·산단·축제장·행사장.
   사고 현장, 짓거나 문 여는 시설, 행사가 열린 곳, 주인공(학생·선수·환자)이 속한 학교·병원·경기장.
orgs: 그 일을 발표·주관·점검·지원한 기관과 회사(○○시청 · ○○청 · ○○연구원 · ○○공사 · ○○상공회의소 · 기업).
   orgs 는 말한 주체이지 일이 일어난 곳이 아니다. 그 기관의 건물에서 일이 일어났을 때만(「광주상의 회의실에서 간담회」) places 에도 넣는다.
광고 · 분양 · 홍보 글에서 「주변에 ○○ · ○○이 있다」처럼 나열한 시설은 places 에도 orgs 에도 넣지 않는다 (분양하는 단지만 places).
places · orgs 는 글에 적힌 이름 그대로, 지역명이 붙어 있으면 붙여서(예: "광주-기아 챔피언스필드", "여수세계섬박람회장", "순천 오천그린광장").
   시군구·읍면동 같은 행정 이름, 「한 아파트」처럼 이름 없는 곳, 기자 소속·사진 제공처, 우리 지역 밖 장소는 넣지 않는다. 없으면 [].

답은 JSON 한 개만: {"mentions": ["글에 나온 지명", ...], "sido": "...", "sigun": "...", "gu": "...", "emd": "...", "places": ["장소 이름", ...], "orgs": ["기관 이름", ...]}

예시
- 「서천, 민선9기 군정 비전 선포식」 → {"mentions": ["서천"], "sido": "충남", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「울산 북구, 노인 일자리 박람회 개최」 → {"mentions": ["울산 북구"], "sido": "울산", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「대전시립미술관, 가을 기획전 개막」 → {"mentions": ["대전"], "sido": "대전", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「광주 광산구 지죽동 폐기물업체 화재」 → {"mentions": ["광산구", "지죽동"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "광산구", "emd": "지죽동", "places": [], "orgs": []}
- 「조선대 석사과정생 학술대회 수상」 → {"mentions": ["조선대"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "", "emd": "", "places": ["조선대학교"], "orgs": []}
- 「전남광주=김대우 기자 / 해경 드론 성능 한계」 → {"mentions": [], "sido": "전국", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「여수세계섬박람회 관람객 155만 돌파」 → {"mentions": ["여수"], "sido": "전남광주통합특별시", "sigun": "여수시", "gu": "", "emd": "", "places": ["여수세계섬박람회장"], "orgs": []}
- 「전남광주시, 지적재조사 국비 확보」 → {"mentions": ["전남광주시"], "sido": "전남광주통합특별시", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「광주도시공사, 청년 임대주택 200호 공급」 → {"mentions": ["광주도시공사"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "", "emd": "", "places": [], "orgs": ["광주도시공사"]}
- 「광주보건환경연구원, 추석 앞두고 진드기 주의 당부」 → {"mentions": ["광주"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "", "emd": "", "places": [], "orgs": ["광주보건환경연구원"]}
- 「영산강청, 여수산단 미세먼지 배출사업장 합동점검」 → {"mentions": ["여수산단"], "sido": "전남광주통합특별시", "sigun": "여수시", "gu": "", "emd": "", "places": ["여수국가산단"], "orgs": ["영산강유역환경청"]}
- 「[날씨] 광주·전남 내일 비…광주지방기상청 "우산 챙기세요"」 → {"mentions": ["광주", "전남"], "sido": "전남광주통합특별시", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": ["광주지방기상청"]}
- 「[내일 날씨] 서울 낮 32도…제주 비, 광주 31도」 → {"mentions": ["서울", "제주", "광주"], "sido": "전국", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": ["기상청"]}
- 「"광주 비행단 임시 분산 최소화해야"…국방부 · 통합특별시장 협의」 → {"mentions": ["광주"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "", "emd": "", "places": ["광주 군공항"], "orgs": ["국방부", "전남광주통합특별시장"]}
- 「운암산공원 우미린 리버포레 8월 분양…서강고 · 영산강 수변공원 가까워」 → {"mentions": ["운암산공원"], "sido": "전남광주통합특별시", "sigun": "광주", "gu": "북구", "emd": "", "places": ["운암산공원 우미린 리버포레"], "orgs": ["우미건설"]}
- 「주말 전국 비 소식…남부지방 최대 60㎜」 → {"mentions": ["남부지방"], "sido": "전국", "sigun": "", "gu": "", "emd": "", "places": [], "orgs": []}
- 「영광군, 굴비축제 이달 개막」 → {"mentions": ["영광군"], "sido": "전남광주통합특별시", "sigun": "영광군", "gu": "", "emd": "", "places": [], "orgs": []}
- 「무안국가산단 분양보증·군공항 합의 촉구」 → {"mentions": ["무안"], "sido": "전남광주통합특별시", "sigun": "무안군", "gu": "", "emd": "", "places": ["무안국가산단", "광주 군공항"], "orgs": []}"""  # noqa: E501 — 잰 프롬프트를 글자 그대로 둔다

HANJA_HINT = "\n\n(답의 모든 값은 한글로 쓴다. 한자 금지)"
LIMIT_HINT = (
    "\n\n(places 에는 기사 주제 장소만 5개까지, mentions 에는 서로 다른 지명만 8개까지 쓴다."
    " 같은 이름을 되풀이하지 않는다)"
)

# SIDO 를 그대로 둘 근거: 제목 · 첫 문장의 통합시 표현
_SIDO_SUBJECT = re.compile(
    r"전남광주|광주[·ㆍ]?전남|전남[·ㆍ]광주|특별시의회|특별시교육청|통합특별시|(?<![가-힣])전남(?![가-힣])"
)
# 광주 수를 셀 때 통합 표현 속 「광주」 · 경기 광주는 뺀다
_GJ_ALONE = re.compile(r"(?<!전남)(?<!전남·)(?<!전남ㆍ)(?<!경기 )광주(?![·ㆍ]?전남)")
_HANJA = re.compile(r"[一-鿿]")
_OUR_SIDO = {"전남", "광주", "전남광주", "전라남도", "광주광역시"}  # OUT:전남 은 OUT 이 아니다
# OUT 뒤 시도 이름 → 줄임말. 「○○시」 꼴도 받는다
_OUT_SHORT = SIDO_SHORT | {
    "서울시": "서울", "부산시": "부산", "대구시": "대구", "인천시": "인천",
    "대전시": "대전", "울산시": "울산", "세종시": "세종",
}  # fmt: skip
_NOT_A_SIDO = {"전국", "국내", "국외", "해외", "없음", "NAT"}
_SHORT_NAMES = tuple(dict.fromkeys(SIDO_SHORT.values()))
# 다른 시도가 「대전·충남·」처럼 나열된 글 (구분 기호 앞뒤에 붙은 이름만 센다)
_OTHER = "|".join((*_SHORT_NAMES, "수도권", "충청권", "영남권"))
_SIDO_LIST = re.compile(
    rf"(?<![가-힣])({_OTHER})(?=\s?[·‧ㆍ,])|(?:(?<=[·‧ㆍ,])|(?<=[·‧ㆍ,]\s))({_OTHER})(?![가-힣])"
)
# 광주시(청 · 의회 · 교육청 · 시의원)나 광주 전체가 주인공인 글
_GJ_CITY_SUBJECT = re.compile(
    r"광주(?:광역)?시(?:청|의회|교육청|의원)?(?:(?![가-힣])|[은는이가의와과도에를을]|에서|로)"
    r"|광주\s?(?:지역|전역|전체)"
)
_GJ_GU_NAMED = re.compile(r"(?:동구|서구|남구|북구|광산구)(?!\d)")  # 시의원 지역구 「북구5」는 뺀다
# 말한 주체일 가능성이 큰 기관 끝말. 대학 · 병원 · 공장은 그 자체가 무대인 때가 많아 넣지 않는다
_AGENCY_END = re.compile(
    r"(?:청|연구원|공사|공단|상공회의소|상의|협회|재단|진흥원|위원회|본부|은행|㈜)$"
)
_VENUE_AFTER = r"\s?(?:\d+층|[가-힣]*(?:회의실|강당|홀|광장)|에서)"


def user_message(article: dict) -> str:
    body = body_text(article.get("title", ""), article.get("lead", ""))
    head = f"매체: {article.get('source', '')}\n제목: {article.get('title', '')}"
    return f"{head}\n본문 앞부분: {body[:BODY_CHARS]}"


def _is_venue(name: str, text: str) -> bool:
    """기관 이름이 글에서 일이 일어난 건물로 쓰였는가 (줄임말 ○○상의도 본다)"""
    alts = {name, name.replace("상공회의소", "상의")}
    return bool(re.search(f"(?:{'|'.join(map(re.escape, alts))}){_VENUE_AFTER}", text))


def normalize(label: str, mentions: list) -> str:
    """표기만 다른 답을 사전 이름으로: 광산구 → 광주 광산구, OUT:경상남도 → OUT:경남,
    OUT:전국 → NAT"""
    places = load()
    s = re.sub(r"\s+", "", label).replace("광주광역시", "광주")
    for gu in ("동구", "서구", "남구", "북구", "광산구"):
        if s in (f"광주{gu}", gu if gu == "광산구" else None):
            return f"광주 {gu}"
    if s.startswith("OUT:") and s[4:] in _OUR_SIDO:
        local = {places.sgg.get(str(m)) for m in mentions} - {None}
        return local.pop() if len(local) == 1 else "SIDO"
    if s.startswith("OUT:"):
        if s[4:] in _NOT_A_SIDO:
            return "NAT"
        short = _OUT_SHORT.get(s[4:], s[4:])
        if short not in _SHORT_NAMES:  # OUT:경상 같은 답 → mentions 의 시도 하나로 (p9.1)
            found = {x for m in mentions for x in _SHORT_NAMES if str(m).startswith(x)}
            short = found.pop() if len(found) == 1 else short
        return "OUT:" + short
    for name in places.sgg_code:  # 여수 → 여수시
        if s and name.replace(" ", "") in (s, s + "시", s + "군"):
            return name
    return label


def check_out(label: str, title: str, text: str, notes: dict) -> str:
    """정부 발표를 정부세종청사 때문에 OUT:세종 으로 답하면 NAT (세종시가 제목에 있으면 그대로)"""
    if label == "OUT:세종" and "세종청사" in text and not re.search(r"세종(?:특별자치)?시", title):
        notes["OUT확인"] = "OUT:세종 → NAT (정부세종청사)"
        return "NAT"
    return label


def check_sido(label: str, title: str, body: str, notes: dict) -> str:
    """SIDO 답 확인: 다른 시도가 2곳 이상 나열되면 NAT. 제목 · 첫 문장에 통합시 표현이 있거나 글에
    시군구가 2곳 이상이면 그대로, 한 곳뿐이면 그곳(광주만 → 광주권), 없으면 NAT.
    (lab p8.2 의 「없으면 장소로 한 시군구」는 장소 확인과 함께 적재로 옮긴다)"""
    if label != "SIDO":
        return label
    others = {a or b for a, b in _SIDO_LIST.findall(f"{title} {body[:200]}")}
    if len(others) >= 2:
        notes["SIDO확인"] = f"SIDO → NAT (다른 시도 {'·'.join(sorted(others))})"
        return "NAT"
    if _SIDO_SUBJECT.search(f"{title} {body[:80]}"):
        return label
    text = f"{title} {body}"
    found = {full for short, full in load().sgg.items() if len(short) >= 2 and short in text}
    if _GJ_ALONE.search(text):
        found.add("광주권")
    if len(found) <= 1:
        new = found.pop() if found else "NAT"
        notes["SIDO확인"] = f"SIDO → {new}"
        return new
    return label


def check_gu(label: str, emd: str, title: str, body: str, notes: dict) -> tuple[str, str]:
    """광주 구 답 확인: 글에 그 구 · 동 이름이 있을 때만 인정.
    광주시 · 광주 전체가 주인공이면 광주권.
    그 밖의 구 답은 추측이라 광주권으로 두고 notes 구추측에 남긴다(장소 확인은 적재에서)"""
    if not label.startswith("광주 "):
        return label, emd
    text, gu = f"{title} {body}", label.removeprefix("광주 ")
    if re.search(rf"{gu}(?!\d)", text) or (emd and emd in text):
        return label, emd
    head = f"{title} {body[:200]}"
    if _GJ_CITY_SUBJECT.search(head) and not _GJ_GU_NAMED.search(head):
        notes["장소확인생략"] = "광주시·광주 전체가 주인공"
    notes["구추측"] = label
    return "광주권", ""


def _names(values) -> list[str]:
    return [str(v).strip() for v in values or [] if str(v).strip()]


def answer(article: dict, ask, first: str | None = None) -> dict:
    """기사 하나 → {sigungu, emd, mentions, places, orgs, notes}.
    ask(system, user, max_tokens) 는 모델 서버.
    first: 미리 받아 둔 첫 답(동시 요청). 재질문은 덧붙임을 달아 다시 묻는다
    (temperature 0 이라 그대로 물으면 같은 답)"""
    user = user_message(article)
    raw = first if first is not None else ask(SYSTEM, user, MAX_TOKENS)
    if _HANJA.search(raw):  # Qwen 이 「順天市」처럼 한자로 답한 일(p5)
        raw = ask(SYSTEM, user + HANJA_HINT, MAX_TOKENS)
    out = parse_json(raw)
    if out is None:  # 지명 · 장소를 늘어놓다 max_tokens 에서 잘린 답
        raw = ask(SYSTEM, user + LIMIT_HINT, MAX_TOKENS)
        out = parse_json(raw)
    if out is None:
        return {"sigungu": "보류", "emd": "", "mentions": [], "places": [], "orgs": [],
                "notes": {"오류": "JSON 아님"}}  # fmt: skip
    title, body = (
        article.get("title", ""),
        body_text(article.get("title", ""), article.get("lead", "")),
    )
    text = f"{title} {body}"
    mentions = _names(out.get("mentions"))
    raw_label = join_region(out.get("sido"), out.get("sigun"), out.get("gu"))
    label = normalize(raw_label, mentions)
    emd = str(out.get("emd") or "").strip()
    places = _names(out.get("places"))
    orgs = _names(out.get("orgs"))
    notes: dict = {"raw_region": [out.get("sido"), out.get("sigun"), out.get("gu")]}
    if dropped := [p for p in places if not_a_place(p)]:
        notes["장소아님_뺌"] = dropped  # 「광주시」 · 「시청」 · 「○○ 누리집」
    org_keys = {o.replace(" ", "") for o in orgs}
    actors = [p for p in places if p not in dropped and p.replace(" ", "") in org_keys
              and _AGENCY_END.search(p.replace(" ", "")) and not _is_venue(p, text)]  # fmt: skip
    if actors:
        notes["기관이라_뺌"] = (
            actors  # orgs 와 같은 이름 — 말한 기관이지 일이 일어난 곳이 아니다(p8.2)
        )
    places = [p for p in places if p not in dropped and p not in actors]
    known = load()
    if not (
        label in known.sgg_code or label in ("광주권", "SIDO", "NAT") or label.startswith("OUT:")
    ):
        notes["오류"] = "사전에 없는 시군구"
        return {"sigungu": "NAT", "emd": "", "mentions": mentions, "places": places,
                "orgs": orgs, "notes": notes}  # fmt: skip
    if emd and not any(e.sgg == label and e.emd == emd for e in known.emd.get(emd, [])):
        notes["오류"] = "시군구 안에 없는 읍면동"
        emd = ""
    label = check_out(label, title, text, notes)
    label = check_sido(label, title, body, notes)
    label, emd = check_gu(label, emd, title, body, notes)
    return {"sigungu": label, "emd": emd, "mentions": mentions, "places": places,
            "orgs": orgs, "notes": notes}  # fmt: skip
