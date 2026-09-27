import io

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def extract_text_from_upload(filename: str, content: bytes) -> tuple[str | None, str | None]:
    """Convert an uploaded file's bytes to plain text. Never raises; returns (text, error)."""
    if len(content) > MAX_UPLOAD_BYTES:
        return None, "File exceeds the 10MB upload limit."

    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return None, f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."

    try:
        if ext == ".pdf":
            return _extract_pdf(content), None
        if ext == ".docx":
            return _extract_docx(content), None
        if ext == ".txt":
            return content.decode("utf-8", errors="replace"), None
    except Exception as exc:  # defensive: never let a parser crash the request
        return None, f"Failed to parse {ext} file: {exc}"

    return None, "Unsupported file type."


def _extract_pdf(content: bytes) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_docx(content: bytes) -> str:
    import docx

    doc = docx.Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)
