from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import parser, matcher

app = FastAPI(
    title="AI Placement Officer - AI Service",
    description="Microservice handling resume parsing, job descriptions structured extraction, and AI scoring/matching.",
    version="1.0.0"
)

def _allowed_origins():
    env_value = os.getenv("AI_SERVICE_CORS_ORIGINS", "")
    if env_value.strip():
        return [origin.strip() for origin in env_value.split(",") if origin.strip()]

    return [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5000",
        "http://localhost:5001",
    ]


# Restrict CORS to trusted frontend/backend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(parser.router)
app.include_router(matcher.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "AI Microservice API"}