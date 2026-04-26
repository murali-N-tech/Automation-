from pydantic import BaseModel
from typing import List, Optional

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
