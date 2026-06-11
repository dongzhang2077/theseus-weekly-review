from fastapi import FastAPI

from review_engine.rules import analyze_week

from .schemas import WeeklyReviewRequest


app = FastAPI(title="Theseus API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "theseus-backend"}


@app.post("/reviews/weekly/analyze")
def analyze_weekly_review(request: WeeklyReviewRequest) -> dict:
    return analyze_week(request.model_dump())

