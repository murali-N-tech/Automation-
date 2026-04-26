import os
from fastapi import APIRouter
from openai import OpenAI

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

# ================= OPENAI CLIENT =================
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ================= JOB SKILL EXTRACTION =================
@router.post("/extract-job-skills", response_model=JobRequirementsRes)
def extract_job_skills(req: JobDescriptionReq):
    """
    Extract required skills from job description.
    (Mock NLP → Replace later with real LLM extraction)
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
    AI Matching Engine:
    - Calculates ATS score
    - Finds missing keywords
    - Returns recommendation
    """

    user_skills_set = set([s.lower().strip() for s in req.resume_skills])
    req_skills_set = set([s.lower().strip() for s in req.job_skills])

    missing_kw = list(req_skills_set - user_skills_set)

    overlap = keyword_overlap_score(
        user_skills=list(user_skills_set),
        required_skills=list(req_skills_set)
    )

    ats_score = overlap * 100.0
    decision = evaluate_decision(overlap)

    return MatchRes(
        ats_score=round(ats_score, 2),
        missing_keywords=missing_kw,
        recommendation=decision
    )


# ================= COVER LETTER GENERATOR (V2 - OPENAI) =================
@router.post("/generate-cover-letter", response_model=CoverLetterRes)
def generate_cover_letter(req: CoverLetterReq):
    """
    Generates a professional 3-paragraph cover letter using OpenAI.
    """

    # Limit skills to keep prompt focused
    top_skills = req.resume_skills[:6] if len(req.resume_skills) >= 6 else req.resume_skills
    skills_str = ", ".join(top_skills) if top_skills else "software engineering"

    prompt = f"""
Write a highly professional, 3-paragraph cover letter for the role of {req.job_title} at {req.company_name}.
The candidate possesses the following key skills: {skills_str}.

Strict Requirements:
- Paragraph 1: Enthusiastic introduction mentioning the specific role and company.
- Paragraph 2: How the candidate's technical skills match the role requirements.
- Paragraph 3: Strong professional closing.
- Keep it under 250 words.
- Do NOT include placeholders like [Your Name].
- Output should be clean and ready to paste.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert career coach writing ATS-optimized cover letters."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=350,
            temperature=0.7
        )

        generated_letter = response.choices[0].message.content.strip()

    except Exception as e:
        print(f"❌ OpenAI Error: {e}")

        # ===== FALLBACK TEMPLATE =====
        generated_letter = (
            f"Dear Hiring Manager,\n\n"
            f"I am writing to express my strong interest in the {req.job_title} position at {req.company_name}. "
            f"With my experience in {skills_str}, I am confident in my ability to contribute effectively to your team.\n\n"
            f"I am eager to bring value and grow within your organization.\n\n"
            f"Thank you for your time and consideration.\n\n"
            f"Sincerely,\nApplicant"
        )

    return CoverLetterRes(cover_letter=generated_letter)