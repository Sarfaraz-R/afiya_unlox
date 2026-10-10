"""Module 1-3: validate PDFs, extract text per page, and split into chunks."""
from typing import BinaryIO

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

MAX_FILE_MB = 20
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120


def validate_pdf(name: str, size_bytes: int) -> str | None:
    """Return an error message, or None if the file is acceptable."""
    if not name.lower().endswith(".pdf"):
        return f"{name}: only PDF files are allowed."
    if size_bytes > MAX_FILE_MB * 1024 * 1024:
        return f"{name}: larger than {MAX_FILE_MB} MB."
    return None


def extract_pages(file: BinaryIO, name: str) -> list[Document]:
    """One Document per non-empty page, tagged with source name and 1-based page number."""
    reader = PdfReader(file)
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:  # skip empty / scanned pages safely
            pages.append(Document(page_content=text, metadata={"source": name, "page": i}))
    return pages


def chunk_documents(pages: list[Document]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    return splitter.split_documents(pages)
