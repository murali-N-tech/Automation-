from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

class JobDescriptionReq(BaseModel):
    description: str

class JobRequirementsRes(BaseModel):
    required_skills: List[str]
    experience_level: Optional[str] = None
    role_type: Optional[str] = None

class ResumeParseRes(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str]
    projects: List[dict]
    experience: List[dict]
    education: List[dict]

class ResumeProject(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)

class ResumeExperience(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None

class ResumeEducation(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    year: Optional[str] = None

class ResumeData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    projects: List[ResumeProject] = Field(default_factory=list)
    experience: List[ResumeExperience] = Field(default_factory=list)
    education: List[ResumeEducation] = Field(default_factory=list)

class MatchReq(BaseModel):
    resume_skills: List[str]
    job_skills: List[str]

class MatchRes(BaseModel):
    ats_score: float
    missing_keywords: List[str]
    recommendation: str  # Apply, Skip, Improve

class CoverLetterReq(BaseModel):
    resume_skills: List[str]
    company_name: str
    job_title: str

class CoverLetterRes(BaseModel):
    cover_letter: str

class JobAnalysisReq(BaseModel):
    resume_data: ResumeData
    job_description: str
    job_title: Optional[str] = None
    company_name: Optional[str] = None

class JobAnalysisRes(BaseModel):
    match_score: int
    strengths: List[str]
    weaknesses: List[str]
    missing_skills: List[str]
    interview_probability: str
    recommendation: str
    extracted_job_skills: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None

class ResumeOptimizationReq(BaseModel):
    resume_data: ResumeData
    job_description: str
    target_variant: Optional[str] = "general"

class ResumeOptimizationRes(BaseModel):
    optimized_resume_text: str
    ats_score: int
    added_keywords: List[str] = Field(default_factory=list)
    suggested_improvements: List[str] = Field(default_factory=list)
    variant: str = "general"

class TailoredCoverLetterReq(BaseModel):
    resume_data: ResumeData
    job_description: str
    company_name: Optional[str] = None
    job_title: Optional[str] = None

class SkillGapReq(BaseModel):
    resume_data: ResumeData
    job_descriptions: List[str]

class SkillGapRes(BaseModel):
    top_missing_skills: List[str]
    course_recommendations: List[str]
    project_ideas: List[str]
    analyzed_jobs: int

class AIInsightRecord(BaseModel):
    type: str
    input: Dict[str, Any]
    output: Dict[str, Any]
