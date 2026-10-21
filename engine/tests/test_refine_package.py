from pipeline.refine import RULE_VERSION


def test_rule_version_is_p2_prefixed():
    # 정제 레코드의 rule_version 칸에 그대로 들어간다
    assert RULE_VERSION.startswith("p2-")
