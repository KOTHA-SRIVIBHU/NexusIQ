import pdfplumber
from typing import List, Dict


def parse_pdf(filepath: str) -> Dict:
    pages = []
    full_text = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page": i + 1, "text": text})
            full_text.append(text)
    return {
        "text": "\n".join(full_text),
        "pages": pages,
        "page_count": len(pages),
    }
