import json
import os
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from dotenv import load_dotenv
from openai import OpenAI

from models.schemas import (
    CoverLetterReq,
    CoverLetterRes,
    JobAnalysisReq,
    JobAnalysisRes,
    JobDescriptionReq,
    JobRequirementsRes,
    MatchReq,
    MatchRes,
    ResumeData,
    ResumeOptimizationReq,
    ResumeOptimizationRes,
    SkillGapReq,
    SkillGapRes,
    TailoredCoverLetterReq,
)
from services.matcher import evaluate_decision, keyword_overlap_score

router = APIRouter(prefix="/matcher", tags=["Matcher"])

load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL) if NVIDIA_API_KEY else None
llm_disabled_reason = None
llm_warning_logged = False

KNOWN_SKILLS = [
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Express",
    "MongoDB",
    "PostgreSQL",
    "MySQL",
    "SQL",
    "FastAPI",
    "Django",
    "Flask",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "Terraform",
    "Git",
    "CI/CD",
    "GraphQL",
    "REST API",
    "Redis",
    "Kafka",
    "Spark",
    "Hadoop",
    "Pandas",
    "NumPy",
    "Scikit-learn",
    "TensorFlow",
    "PyTorch",
    "Machine Learning",
    "Deep Learning",
    "LLM",
    "NLP",
    "Data Analysis",
    "Power BI",
    "Tableau",
    "Excel",
    "Selenium",
    "Playwright",
    "JUnit",
    "Jest",
    "Cypress",
    "Linux",
    "Microservices",
]

SKILL_ALIASES = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "reactjs": "React",
    "react.js": "React",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "express.js": "Express",
    "mongodb": "MongoDB",
    "mongo": "MongoDB",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "aws": "AWS",
    "amazon web services": "AWS",
    "gcp": "GCP",
    "google cloud": "GCP",
    "ci/cd": "CI/CD",
    "graphql": "GraphQL",
    "rest": "REST API",
    "rest api": "REST API",
    "fast api": "FastAPI",
    "fastapi": "FastAPI",
    "ml": "Machine Learning",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "nlp": "NLP",
    "llm": "LLM",
    "powerbi": "Power BI",
    "tableau": "Tableau",
    "excel": "Excel",
}

COURSE_LIBRARY = {
    "AWS": "AWS Cloud Practitioner or AWS Solutions Architect Associate",
    "Docker": "Docker for Developers or Docker Essentials",
    "Kubernetes": "Kubernetes for Application Developers (CKAD prep)",
    "Terraform": "HashiCorp Terraform Associate track",
    "React": "Advanced React and Frontend System Design",
    "Node.js": "Node.js API and Backend Architecture",
    "Machine Learning": "Applied Machine Learning Specialization",
    "Deep Learning": "Deep Learning Specialization",
    "SQL": "Advanced SQL for Analytics and Backend Development",
    "System Design": "Scalable System Design Fundamentals",
}

PROJECT_LIBRARY = {
    "AWS": "Deploy a containerized web app on AWS using ECS or Lambda and API Gateway.",
    "Docker": "Containerize a full-stack app with multi-stage builds and local compose setup.",
    "Kubernetes": "Ship a small microservice app to Kubernetes with health checks and autoscaling.",
    "Terraform": "Provision a cloud-ready dev environment with Terraform modules and state management.",
    "React": "Build a polished dashboard with role-based views, charts, and accessibility support.",
    "Node.js": "Create a production-style REST API with auth, queues, retries, and observability.",
    "Machine Learning": "Train and deploy an end-to-end classifier with monitoring and error analysis.",
    "Deep Learning": "Build a domain-specific neural network project with evaluation reports and inference API.",
    "SQL": "Design a reporting data mart and write business-grade analytics queries.",
    "System Design": "Document and prototype a scalable architecture for an application with 1M users.",
}


def llm_is_available() -> bool:
    return client is not None and llm_disabled_reason is None


def disable_llm(reason: str) -> None:
    global llm_disabled_reason, llm_warning_logged

    llm_disabled_reason = reason
    if not llm_warning_logged:
        print(f"NVIDIA LLM disabled. Falling back to local heuristics. Reason: {reason}")
        llm_warning_logged = True


def handle_llm_error(err: Exception, context: str) -> None:
    error_text = str(err)
    lowered = error_text.lower()

    if "invalid_api_key" in lowered or "incorrect api key" in lowered or "error code: 401" in lowered:
        disable_llm("The configured NVIDIA_API_KEY is invalid.")
        return

    if "insufficient_quota" in lowered or "quota" in lowered:
        disable_llm("The configured NVIDIA account does not have available quota.")
        return

    print(f"NVIDIA LLM {context} failed. Using fallback path. Reason: {error_text}")


def canonicalize_skill(skill: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(skill or "").strip())
    if not cleaned:
        return ""

    alias = SKILL_ALIASES.get(cleaned.lower())
    if alias:
        return alias

    for known in KNOWN_SKILLS:
        if cleaned.lower() == known.lower():
            return known

    return cleaned


def dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    ordered = []

    for item in items:
        canonical = canonicalize_skill(item)
        key = canonical.lower()
        if not canonical or key in seen:
            continue
        seen.add(key)
        ordered.append(canonical)

    return ordered


def normalize_interview_probability(value: Any, fallback: str) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        normalized = float(value)
        # Accept either ratios (0-1) or percentages (0-100+).
        if 0 <= normalized <= 1:
            normalized *= 100
        normalized = max(0, min(100, normalized))
        return f"{normalized:.0f}%"

    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return fallback

        try:
            numeric_value = float(cleaned)
            if 0 <= numeric_value <= 1:
                numeric_value *= 100
            numeric_value = max(0, min(100, numeric_value))
            return f"{numeric_value:.0f}%"
        except ValueError:
            return cleaned

    return fallback


def normalize_cover_letter_text(value: Any, fallback: str) -> str:
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or fallback

    if isinstance(value, dict):
        for key in ("cover_letter", "text", "content", "letter"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()

    return fallback


def extract_known_skills(text: str) -> List[str]:
    normalized = str(text or "")
    found = []

    for skill in KNOWN_SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill) + r"(?!\w)"
        if re.search(pattern, normalized, re.IGNORECASE):
            found.append(skill)

    special_patterns = {
        "CI/CD": r"\bci\/cd\b|\bcontinuous integration\b|\bcontinuous delivery\b",
        "REST API": r"\brest\b|\brestful\b|\bapi development\b",
        "Machine Learning": r"\bmachine learning\b|\bml\b",
        "Deep Learning": r"\bdeep learning\b",
        "LLM": r"\bllm\b|\blarge language model",
    }

    for skill, pattern in special_patterns.items():
        if re.search(pattern, normalized, re.IGNORECASE):
            found.append(skill)

    return dedupe_keep_order(found)


def resume_skill_inventory(resume_data: ResumeData) -> List[str]:
    collected = list(resume_data.skills or [])

    for project in resume_data.projects or []:
        collected.extend(project.technologies or [])
        if project.description:
            collected.extend(extract_known_skills(project.description))

    for exp in resume_data.experience or []:
        if exp.description:
            collected.extend(extract_known_skills(exp.description))
        if exp.role:
            collected.extend(extract_known_skills(exp.role))

    if resume_data.summary:
        collected.extend(extract_known_skills(resume_data.summary))

    return dedupe_keep_order(collected)


def resume_experience_highlights(resume_data: ResumeData) -> List[str]:
    highlights = []
    for exp in resume_data.experience[:3]:
        parts = [exp.role or "", exp.company or "", exp.duration or ""]
        label = " - ".join([part for part in parts if part])
        if exp.description:
            label = f"{label}: {exp.description}" if label else exp.description
        if label:
            highlights.append(label)

    for project in resume_data.projects[:2]:
        project_line = project.name or "Project"
        if project.description:
            project_line = f"{project_line}: {project.description}"
        if project.technologies:
            project_line = f"{project_line} ({', '.join(project.technologies[:5])})"
        highlights.append(project_line)

    return highlights[:5]


def summarize_resume(resume_data: ResumeData) -> str:
    summary = []
    if resume_data.summary:
        summary.append(resume_data.summary.strip())

    skills = resume_skill_inventory(resume_data)
    if skills:
        summary.append(f"Core skills: {', '.join(skills[:10])}.")

    highlights = resume_experience_highlights(resume_data)
    if highlights:
        summary.append("Experience highlights: " + " | ".join(highlights[:3]))

    return " ".join(summary).strip()


def score_resume_against_job(resume_data: ResumeData, job_description: str) -> Dict[str, Any]:
    resume_skills = resume_skill_inventory(resume_data)
    job_skills = extract_known_skills(job_description)

    resume_set = {skill.lower() for skill in resume_skills}
    job_set = {skill.lower() for skill in job_skills}

    strengths = [skill for skill in resume_skills if skill.lower() in job_set][:8]
    missing_skills = [skill for skill in job_skills if skill.lower() not in resume_set]

    overlap = keyword_overlap_score(resume_skills, job_skills)
    keyword_score = overlap * 100

    experience_bonus = 0
    if resume_data.experience:
        experience_bonus += min(len(resume_data.experience) * 4, 12)
    if resume_data.projects:
        experience_bonus += min(len(resume_data.projects) * 2, 6)
    if resume_data.summary:
        experience_bonus += 4

    missing_penalty = min(len(missing_skills) * 4, 20)
    raw_score = round(keyword_score + experience_bonus - missing_penalty)
    match_score = max(20 if strengths else 5, min(raw_score, 96))

    weaknesses = missing_skills[:6]
    if not weaknesses and len(strengths) < 3:
        weaknesses = ["Resume could better emphasize measurable impact and role-specific keywords."]

    if match_score >= 85:
        probability = "High"
        recommendation = "Strong match. Apply now."
    elif match_score >= 70:
        probability = "Medium-High"
        recommendation = "Apply. Tailor the resume slightly before submitting."
    elif match_score >= 55:
        probability = "Medium"
        recommendation = "Apply selectively after improving the missing skills and resume keywords."
    else:
        probability = "Low-Medium"
        recommendation = "Improve core gaps first, then re-target similar roles."

    explanation = (
        f"The resume matches {len(strengths)} of {len(job_skills) or 1} visible skill signals. "
        f"Top aligned skills: {', '.join(strengths[:4]) or 'none identified'}. "
        f"Most important gaps: {', '.join(missing_skills[:4]) or 'no major skill gaps detected'}."
    )

    return {
        "match_score": match_score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_skills": missing_skills,
        "interview_probability": probability,
        "recommendation": recommendation,
        "extracted_job_skills": job_skills,
        "explanation": explanation,
    }


def try_llm_json(system_prompt: str, user_prompt: str) -> Optional[Dict[str, Any]]:
    if not llm_is_available():
        return None

    try:
        response = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=900,
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as err:
        handle_llm_error(err, "JSON generation")
        return None


def build_optimized_resume_text(
    resume_data: ResumeData,
    job_description: str,
    target_variant: str,
    analysis: Dict[str, Any],
) -> str:
    missing_skills = analysis["missing_skills"][:6]
    strengths = analysis["strengths"][:8]
    variant = (target_variant or "general").strip() or "general"

    summary = resume_data.summary or (
        f"Results-oriented candidate targeting {variant} opportunities with strengths in "
        f"{', '.join(strengths[:4]) or 'software engineering'}."
    )

    variant_tone = {
        "startup": "Emphasize ownership, speed, experimentation, and end-to-end execution.",
        "mnc": "Emphasize scale, process discipline, reliability, and cross-functional collaboration.",
        "ml-focused": "Emphasize data, experimentation, model deployment, and measurable evaluation.",
        "general": "Emphasize role alignment, measurable outcomes, and ATS keyword coverage.",
    }.get(variant.lower(), "Emphasize role alignment, measurable outcomes, and ATS keyword coverage.")

    keywords_line = ", ".join(dedupe_keep_order(strengths + missing_skills)[:12])
    skills_line = ", ".join(dedupe_keep_order(resume_skill_inventory(resume_data) + missing_skills)[:16])

    lines = [
        f"TARGET VARIANT: {variant}",
        "",
        "PROFESSIONAL SUMMARY",
        summary,
        variant_tone,
        "",
        "CORE SKILLS",
        skills_line or "Add more role-specific skills.",
        "",
        "EXPERIENCE HIGHLIGHTS",
    ]

    if resume_data.experience:
        for exp in resume_data.experience:
            header = " | ".join([part for part in [exp.role, exp.company, exp.duration] if part])
            description = exp.description or "Add a quantified impact bullet tailored to the target role."
            lines.append(f"- {header}: {description}".strip())
    else:
        lines.append("- Add experience bullets that show ownership, impact, and role-relevant tooling.")

    lines.extend(["", "PROJECT HIGHLIGHTS"])
    if resume_data.projects:
        for project in resume_data.projects:
            techs = ", ".join(project.technologies[:6]) if project.technologies else keywords_line
            lines.append(
                f"- {project.name or 'Project'}: {project.description or 'Highlight the business or technical outcome.'}"
                + (f" Technologies: {techs}." if techs else "")
            )
    else:
        lines.append("- Add 1-2 projects that demonstrate the exact stack and outcomes required by the role.")

    lines.extend([
        "",
        "ATS KEYWORDS TO WEAVE NATURALLY",
        keywords_line or "No strong keyword gaps identified.",
        "",
        "TAILORING NOTES",
        f"- Promote these matched skills early: {', '.join(strengths[:5]) or 'your strongest job-relevant skills'}.",
        f"- Add evidence for these gaps where truthful: {', '.join(missing_skills[:5]) or 'no major gaps detected'}.",
        "- Prefer impact-driven bullets with metrics, ownership, and technologies used.",
    ])

    return "\n".join(lines).strip()


def build_tailored_cover_letter(
    resume_data: ResumeData,
    job_description: str,
    company_name: Optional[str],
    job_title: Optional[str],
) -> str:
    analysis = score_resume_against_job(resume_data, job_description)
    matched = ", ".join(analysis["strengths"][:4]) or "software engineering"
    summary = resume_data.summary or "building reliable, user-focused software solutions"
    experience_bit = resume_experience_highlights(resume_data)
    proof = experience_bit[0] if experience_bit else "hands-on project and professional experience"

    return (
        f"Dear Hiring Manager,\n\n"
        f"I am excited to apply for the {job_title or 'role'} position at {company_name or 'your company'}. "
        f"My background centers on {summary}, and I believe that foundation aligns well with the needs outlined in your job description.\n\n"
        f"My experience with {matched} gives me a strong base for this opportunity. "
        f"In particular, {proof}. I enjoy translating technical requirements into dependable solutions, collaborating across teams, "
        f"and improving systems with measurable impact.\n\n"
        f"I would welcome the opportunity to contribute to {company_name or 'your team'} and bring a thoughtful, execution-focused approach "
        f"to the {job_title or 'position'}. Thank you for your time and consideration.\n\n"
        f"Sincerely,\n{resume_data.name or 'Applicant'}"
    )


@router.post("/extract-job-skills", response_model=JobRequirementsRes)
def extract_job_skills(req: JobDescriptionReq):
    found_skills = extract_known_skills(req.description)

    if not found_skills:
        found_skills = ["Software Engineering"]

    experience_level = "Mid-Level"
    text_lower = req.description.lower()
    if any(token in text_lower for token in ["senior", "lead", "staff", "principal"]):
        experience_level = "Senior"
    elif any(token in text_lower for token in ["intern", "fresher", "junior", "entry level"]):
        experience_level = "Entry-Level"

    role_type = "Full-time"
    if "contract" in text_lower:
        role_type = "Contract"
    elif "intern" in text_lower:
        role_type = "Internship"

    return JobRequirementsRes(
        required_skills=found_skills,
        experience_level=experience_level,
        role_type=role_type,
    )


@router.post("/score-job", response_model=MatchRes)
def score_job(req: MatchReq):
    user_skills = dedupe_keep_order(req.resume_skills)
    job_skills = dedupe_keep_order(req.job_skills)

    user_skills_set = {s.lower().strip() for s in user_skills}
    req_skills_set = {s.lower().strip() for s in job_skills}
    missing_kw = [skill for skill in job_skills if skill.lower() not in user_skills_set]

    overlap = keyword_overlap_score(
        user_skills=list(user_skills_set),
        required_skills=list(req_skills_set),
    )

    ats_score = overlap * 100.0
    decision = evaluate_decision(overlap)

    return MatchRes(
        ats_score=round(ats_score, 2),
        missing_keywords=missing_kw,
        recommendation=decision,
    )


@router.post("/job-analysis", response_model=JobAnalysisRes)
def analyze_job(req: JobAnalysisReq):
    fallback = score_resume_against_job(req.resume_data, req.job_description)

    system_prompt = (
        "You are an expert recruiting analyst. Compare a candidate resume against a job description "
        "and return concise JSON only."
    )
    user_prompt = f"""
Analyze the candidate resume against the job description.

Return JSON with:
- match_score (0-100 integer)
- strengths (array)
- weaknesses (array)
- missing_skills (array)
- interview_probability
- recommendation
- extracted_job_skills (array)
- explanation

Candidate resume summary:
{summarize_resume(req.resume_data)}

Structured resume data:
{req.resume_data.model_dump_json(indent=2)}

Job title: {req.job_title or ""}
Company name: {req.company_name or ""}
Job description:
{req.job_description}
"""
    llm_result = try_llm_json(system_prompt, user_prompt)

    if llm_result:
        merged = {
            "match_score": int(llm_result.get("match_score", fallback["match_score"])),
            "strengths": dedupe_keep_order(llm_result.get("strengths") or fallback["strengths"]),
            "weaknesses": llm_result.get("weaknesses") or fallback["weaknesses"],
            "missing_skills": dedupe_keep_order(llm_result.get("missing_skills") or fallback["missing_skills"]),
            "interview_probability": normalize_interview_probability(
                llm_result.get("interview_probability"),
                fallback["interview_probability"],
            ),
            "recommendation": llm_result.get("recommendation") or fallback["recommendation"],
            "extracted_job_skills": dedupe_keep_order(llm_result.get("extracted_job_skills") or fallback["extracted_job_skills"]),
            "explanation": llm_result.get("explanation") or fallback["explanation"],
        }
        merged["match_score"] = max(0, min(100, merged["match_score"]))
        return JobAnalysisRes(**merged)

    return JobAnalysisRes(**fallback)


@router.post("/optimize-resume", response_model=ResumeOptimizationRes)
def optimize_resume(req: ResumeOptimizationReq):
    analysis = score_resume_against_job(req.resume_data, req.job_description)
    variant = (req.target_variant or "general").strip() or "general"
    optimized_text = build_optimized_resume_text(req.resume_data, req.job_description, variant, analysis)

    llm_result = try_llm_json(
        "You are an ATS resume optimization assistant. Return JSON only.",
        f"""
Create a tailored resume rewrite from the provided structured resume data and job description.

Return JSON with:
- optimized_resume_text
- ats_score
- added_keywords
- suggested_improvements
- variant

Target variant: {variant}
Structured resume data:
{req.resume_data.model_dump_json(indent=2)}

Job description:
{req.job_description}
""",
    )

    if llm_result:
        return ResumeOptimizationRes(
            optimized_resume_text=llm_result.get("optimized_resume_text") or optimized_text,
            ats_score=max(0, min(100, int(llm_result.get("ats_score", analysis["match_score"] + 8)))),
            added_keywords=dedupe_keep_order(llm_result.get("added_keywords") or analysis["missing_skills"][:8]),
            suggested_improvements=llm_result.get("suggested_improvements") or [
                "Move the most relevant skills closer to the top of the resume.",
                "Add metrics and outcomes to the most recent experience bullets.",
                "Mirror important job keywords only where they are truthful.",
            ],
            variant=llm_result.get("variant") or variant,
        )

    return ResumeOptimizationRes(
        optimized_resume_text=optimized_text,
        ats_score=max(0, min(100, analysis["match_score"] + 8)),
        added_keywords=analysis["missing_skills"][:8],
        suggested_improvements=[
            "Promote your strongest role-relevant skills into the summary and top experience bullets.",
            "Add outcome-focused metrics for the most relevant projects and roles.",
            "Use the missing keywords only where they reflect real experience or learning.",
        ],
        variant=variant,
    )


@router.post("/generate-cover-letter", response_model=CoverLetterRes)
def generate_cover_letter(req: CoverLetterReq):
    top_skills = dedupe_keep_order(req.resume_skills)[:6]
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
        if llm_is_available():
            response = client.chat.completions.create(
                model=NVIDIA_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert career coach writing ATS-optimized cover letters.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=350,
                temperature=0.7,
            )
            generated_letter = (response.choices[0].message.content or "").strip()
            if generated_letter:
                return CoverLetterRes(cover_letter=generated_letter)
    except Exception as err:
        handle_llm_error(err, "cover letter generation")

    generated_letter = (
        f"Dear Hiring Manager,\n\n"
        f"I am writing to express my strong interest in the {req.job_title} position at {req.company_name}. "
        f"With my experience in {skills_str}, I am confident in my ability to contribute effectively to your team.\n\n"
        f"I am eager to bring value, collaborate closely, and keep growing in a high-impact environment.\n\n"
        f"Thank you for your time and consideration.\n\n"
        f"Sincerely,\nApplicant"
    )
    return CoverLetterRes(cover_letter=generated_letter)


@router.post("/cover-letter-tailored", response_model=CoverLetterRes)
def generate_tailored_cover_letter(req: TailoredCoverLetterReq):
    fallback_letter = build_tailored_cover_letter(
        req.resume_data,
        req.job_description,
        req.company_name,
        req.job_title,
    )

    llm_result = try_llm_json(
        "You are an expert career coach. Return JSON only.",
        f"""
Write a professional cover letter tailored to this job using the candidate's experience.

Return JSON with:
- cover_letter

Structured resume data:
{req.resume_data.model_dump_json(indent=2)}

Job title: {req.job_title or ""}
Company name: {req.company_name or ""}
Job description:
{req.job_description}
""",
    )

    if llm_result:
        llm_cover_letter = normalize_cover_letter_text(llm_result.get("cover_letter"), fallback_letter)
        return CoverLetterRes(cover_letter=llm_cover_letter)

    return CoverLetterRes(cover_letter=fallback_letter)


@router.post("/skill-gap", response_model=SkillGapRes)
def analyze_skill_gap(req: SkillGapReq):
    resume_skills = {skill.lower(): skill for skill in resume_skill_inventory(req.resume_data)}
    missing_counter = Counter()

    for job_description in req.job_descriptions:
        for skill in extract_known_skills(job_description):
            if skill.lower() not in resume_skills:
                missing_counter[skill] += 1

    top_missing = [skill for skill, _count in missing_counter.most_common(8)]
    top_missing = top_missing or ["System Design", "AWS", "Docker"]

    return SkillGapRes(
        top_missing_skills=top_missing,
        course_recommendations=[
            COURSE_LIBRARY.get(skill, f"Take a focused course or guided learning path for {skill}.")
            for skill in top_missing[:5]
        ],
        project_ideas=[
            PROJECT_LIBRARY.get(skill, f"Build a portfolio project that proves hands-on experience with {skill}.")
            for skill in top_missing[:5]
        ],
        analyzed_jobs=len(req.job_descriptions),
    )
