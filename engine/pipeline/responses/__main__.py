"""python -m pipeline.responses --db → 기존 대응 후보 추출 (extract.py)."""

import sys

from .extract import main

if __name__ == "__main__":
    sys.exit(main())
