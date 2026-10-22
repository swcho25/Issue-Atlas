import copy

import pytest

from tests.samples import HASH, KOSIS


@pytest.fixture
def passing_record():
    """content_hash 만 채운 KOSIS 실샘플. 다른 규칙에는 걸리지 않는다."""
    return {**copy.deepcopy(KOSIS[0]), "content_hash": HASH}
