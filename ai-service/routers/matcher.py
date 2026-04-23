from fastapi import APIRouter
from models.schemas import JobDescriptionReq, JobRequirementsRes, MatchReq, MatchRes
from services.matcher import keyword_overlap_score, evaluate_decision

router = APIRouter(prefix="/matcher", tags=["Matcher"])

@router.post("/extract-job-skills", response_model=JobRequirementsRes)
def extract_job_skills(req: JobDescriptionReq):
    """
    Simulates extracting required skills from a raw JD text using NLP/LLMs.
    """
    # Mock fallback extraction if LLMs are not present
    text_lower = req.description.lower()
    
    mock_keywords = ["python", "react", "node.js", "mongodb", "fastapi", "docker", "aws"]
    found_skills = [k for k in mock_keywords if k in text_lower]
    
    if not found_skills:
        found_skills = ["Software Engineering"]

    return JobRequirementsRes(
        required_skills=found_skills,
        experience_level="Mid-Level",
        role_type="Full-time"
    )

@router.post("/score-job", response_model=MatchRes)
def score_job(req: MatchReq):
    """
    Executes the Decision Engine rules.
    Outputs: ATS Score, Missing Keywords, Recommendation.
    """
    user_skills_set = set([s.lower().strip() for s in req.resume_skills])
    req_skills_set = set([s.lower().strip() for s in req.job_skills])
    
    missing_kw = list(req_skills_set - user_skills_set)
    
    # Simple semantic/keyword overlap computation for ATS Score
    # We could augment this with a text-embedding generation logic for actual Cosine Similarity mapping
    overlap = keyword_overlap_score(user_skills=list(user_skills_set), required_skills=list(req_skills_set))
    
    ats_score = overlap * 100.0  # normalize to 100 percentage
    
    decision = evaluate_decision(overlap)

    return MatchRes(
        ats_score=round(ats_score, 2),
        missing_keywords=missing_kw,
        recommendation=decision
    )