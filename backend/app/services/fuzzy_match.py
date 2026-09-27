from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models.deviation import Deviation

MAX_MATCHES = 3

# difflib's SequenceMatcher operates on raw character sequences, not word overlap or semantics,
# so two paraphrased descriptions of the same real incident often score well under 0.6 even
# though they're clearly the same event. 0.45 was tuned against real examples: a genuinely
# similar (paraphrased) deviation scored ~0.56, while an unrelated deviation scored ~0.04.
SIMILARITY_THRESHOLD = 0.45


def find_similar_deviations(db: Session, title: str | None, description: str | None) -> list[dict]:
    """Fuzzy-matches a candidate title/description against saved deviations using
    difflib's SequenceMatcher — no extra dependency needed for a 36h build."""
    candidate = " ".join(filter(None, [title, description])).strip().lower()
    if not candidate:
        return []

    existing = db.query(Deviation.id, Deviation.title, Deviation.detailed_description).filter(
        Deviation.status == "saved"
    ).all()

    matches = []
    for dev_id, dev_title, dev_description in existing:
        comparison = " ".join(filter(None, [dev_title, dev_description])).strip().lower()
        if not comparison:
            continue
        similarity = SequenceMatcher(None, candidate, comparison).ratio()
        if similarity >= SIMILARITY_THRESHOLD:
            matches.append({"id": str(dev_id), "title": dev_title, "similarity": round(similarity, 2)})

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    return matches[:MAX_MATCHES]
