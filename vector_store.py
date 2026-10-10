"""Module 4: embeddings + FAISS index (build, save, load)."""
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
INDEX_DIR = Path(__file__).parent / "vector_store" / "saved_index"

_embeddings = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            encode_kwargs={"normalize_embeddings": True},  # inner product == cosine similarity
        )
    return _embeddings


def build_index(chunks) -> FAISS:
    return FAISS.from_documents(chunks, get_embeddings())


def save_index(index: FAISS) -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    index.save_local(str(INDEX_DIR))


def load_index() -> FAISS | None:
    if not (INDEX_DIR / "index.faiss").exists():
        return None
    # The index is written by this app only, so pickle deserialization is safe here.
    return FAISS.load_local(str(INDEX_DIR), get_embeddings(), allow_dangerous_deserialization=True)
