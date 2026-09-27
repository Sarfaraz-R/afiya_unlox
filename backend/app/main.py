from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import deviations, extract
from app.config import settings

app = FastAPI(title="Deviation Intake API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router, prefix="/api")
app.include_router(deviations.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
