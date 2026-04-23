from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import parser, matcher

app = FastAPI(
    title="AI Placement Officer - AI Service",
    description="Microservice handling resume parsing, job descriptions structured extraction, and AI scoring/matching.",
    version="1.0.0"
)

# Allow CORS since Node.js / React will interact with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parser.router)
app.include_router(matcher.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "AI Microservice API"}