"""Modules 5-6: retrieve top-k chunks and generate a grounded answer with Groq."""
import os
import time

from dotenv import load_dotenv
from groq import Groq

from prompt import NOT_FOUND_MESSAGE, SYSTEM_PROMPT, USER_TEMPLATE, format_context

load_dotenv()

TOP_K = 4
MAX_SCORE_DISTANCE = 1.6  # L2 distance on normalized vectors; above this, chunk is unrelated


def retrieve(index, question: str, k: int = TOP_K):
    results = index.similarity_search_with_score(question, k=k)
    return [d for d, score in results if score <= MAX_SCORE_DISTANCE]


def answer_question(index, question: str) -> dict:
    start = time.time()
    docs = retrieve(index, question)
    if not docs:
        return {"answer": NOT_FOUND_MESSAGE, "sources": [], "seconds": time.time() - start}

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_TEMPLATE.format(context=format_context(docs), question=question)},
        ],
    )
    answer = response.choices[0].message.content.strip()
    sources = [] if NOT_FOUND_MESSAGE in answer else [
        {"source": d.metadata["source"], "page": d.metadata["page"], "snippet": d.page_content[:300]}
        for d in docs
    ]
    return {"answer": answer, "sources": sources, "seconds": time.time() - start}
