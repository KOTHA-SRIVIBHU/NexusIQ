from typing import Dict


def parse_text(filepath: str) -> Dict:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    return {
        "text": text,
        "page_count": None,
    }
