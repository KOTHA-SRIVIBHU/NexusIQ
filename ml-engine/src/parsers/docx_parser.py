import docx
from typing import Dict


def parse_docx(filepath: str) -> Dict:
    doc = docx.Document(filepath)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n".join(paragraphs)
    return {
        "text": text,
        "page_count": None,
    }
