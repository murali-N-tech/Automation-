from fastapi import APIRouter
from models.schemas import (
    JobDescriptionReq,
    JobRequirementsRes,
    MatchReq,
    MatchRes,
    CoverLetterReq,
    CoverLetterRes
)
from services.matcher import keyword_overlap_score, evaluate_decision

router = APIRouter(prefix="/matcher", tags=["Matcher"])


# ================= JOB SKILL EXTRACTION =================
@router.post("/extract-job-skills", response_model=JobRequirementsRes)
def extract_job_skills(req: JobDescriptionReq):
    """
    Simulates extracting required skills from a raw JD text using NLP/LLMs.
    """
    text_lower = req.description.lower()

    mock_keywords = [
        "python",
        "react",
        "node.js",
        "mongodb",
        "fastapi",
        "docker",
        "aws"
    ]

    found_skills = [k for k in mock_keywords if k in text_lower]

    if not found_skills:
        found_skills = ["Software Engineering"]

    return JobRequirementsRes(
        required_skills=found_skills,
        experience_level="Mid-Level",
        role_type="Full-time"
    )


# ================= ATS SCORING =================
@router.post("/score-job", response_model=MatchRes)
def score_job(req: MatchReq):
    """
    Executes the Decision Engine rules.
    Outputs: ATS Score, Missing Keywords, Recommendation.
    """
    user_skills_set = set([s.lower().strip() for s in req.resume_skills])
    req_skills_set = set([s.lower().strip() for s in req.job_skills])

    missing_kw = list(req_skills_set - user_skills_set)

    # Keyword overlap scoring
    overlap = keyword_overlap_score(
        user_skills=list(user_skills_set),
        required_skills=list(req_skills_set)
    )

    ats_score = overlap * 100.0  # convert to percentage
    decision = evaluate_decision(overlap)

    return MatchRes(
        ats_score=round(ats_score, 2),
        missing_keywords=missing_kw,
        recommendation=decision
    )


# ================= COVER LETTER GENERATOR =================
@router.post("/generate-cover-letter", response_model=CoverLetterRes)
def generate_cover_letter(req: CoverLetterReq):
    """
    Generates a targeted cover letter based on the user's skills and job details.
    In production, replace this with an LLM (OpenAI, Claude, etc.)
    """

    # Pick top 3 skills
    top_skills = (
        req.resume_skills[:3]
        if len(req.resume_skills) >= 3
        else req.resume_skills
    )

    skills_str = ", ".join(top_skills) if top_skills else "software engineering"

    # Template-based generation
    template = (
        f"Dear Hiring Manager at {req.company_name},\n\n"
        f"I am writing to express my strong interest in the {req.job_title} position at your company. "
        f"With my foundational experience in {skills_str}, I am confident in my ability to contribute "
        f"effectively to your engineering team from day one.\n\n"
        f"I admire the work {req.company_name} is doing and would welcome the opportunity to discuss how "
        f"my background, alongside my eagerness to learn and grow, aligns with your needs.\n\n"
        f"Thank you for considering my application.\n\n"
        f"Sincerely,\n"
        f"[Your Name Here]"
    )

    return CoverLetterRes(cover_letter=template)