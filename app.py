"""Module 7: Streamlit interface."""
import streamlit as st

from document_loader import chunk_documents, extract_pages, validate_pdf
from rag_pipeline import answer_question
from vector_store import build_index, load_index, save_index

st.set_page_config(page_title="Domain-Specific RAG Chatbot", page_icon="📄", layout="wide")

st.session_state.setdefault("messages", [])
if "index" not in st.session_state:
    st.session_state.index = load_index()
    st.session_state.doc_names = []


def render_sources(sources):
    if sources:
        with st.expander("Sources"):
            for s in sources:
                st.markdown(f"**{s['source']}**, page {s['page']}")
                st.caption(s["snippet"] + "…")


with st.sidebar:
    st.header("Documents")
    files = st.file_uploader("Upload PDF files", type=["pdf"], accept_multiple_files=True)
    if st.button("Process Documents", type="primary", disabled=not files):
        pages, errors = [], []
        for f in files:
            err = validate_pdf(f.name, f.size)
            if err:
                errors.append(err)
                continue
            try:
                pages += extract_pages(f, f.name)
            except Exception as exc:
                errors.append(f"{f.name}: could not read PDF ({exc}).")
        for e in errors:
            st.error(e)
        if pages:
            with st.spinner("Chunking and embedding…"):
                chunks = chunk_documents(pages)
                st.session_state.index = build_index(chunks)
                save_index(st.session_state.index)
                st.session_state.doc_names = sorted({p.metadata["source"] for p in pages})
            st.session_state.messages = []
            st.success(f"Indexed {len(pages)} pages into {len(chunks)} chunks.")
        elif not errors:
            st.warning("No extractable text found (scanned PDFs need OCR).")

    if st.session_state.doc_names:
        st.write("**Loaded:**")
        for n in st.session_state.doc_names:
            st.write(f"• {n}")
    elif st.session_state.index:
        st.caption("Using previously saved index.")

    if st.button("Clear Chat"):
        st.session_state.messages = []
        st.rerun()

st.title("Domain-Specific RAG Chatbot for PDF Question Answering")
st.caption("Answers come only from your uploaded documents. Please verify high-stakes information "
           "(legal, medical, financial) against the original source.")

for m in st.session_state.messages:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])
        render_sources(m.get("sources"))

if question := st.chat_input("Ask a question about your documents"):
    st.session_state.messages.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)
    with st.chat_message("assistant"):
        if st.session_state.index is None:
            result = {"answer": "Please upload and process at least one PDF first.", "sources": []}
            st.markdown(result["answer"])
        else:
            try:
                with st.spinner("Thinking…"):
                    result = answer_question(st.session_state.index, question)
                st.markdown(result["answer"])
                render_sources(result["sources"])
                st.caption(f"Answered in {result['seconds']:.1f}s")
            except Exception as exc:
                result = {"answer": f"Error: {exc}", "sources": []}
                st.error(result["answer"])
    st.session_state.messages.append(
        {"role": "assistant", "content": result["answer"], "sources": result["sources"]}
    )
