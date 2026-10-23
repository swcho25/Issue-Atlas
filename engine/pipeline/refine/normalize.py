"""정규화: 뜻은 그대로 두고 표현만 맞춘다."""

# double 이 보장하는 유효숫자. 그 뒤 자리는 이진 표현 오차라 지운다 (0.0033000000000000004 → 0.0033)
SIGNIFICANT_DIGITS = 15


def clean_number(value):
    # 정수는 건드리지 않는다. 25 가 25.0 이 되면 JSON 바이트가 바뀐다
    if isinstance(value, float):
        return float(f"{value:.{SIGNIFICANT_DIGITS}g}")
    return value
