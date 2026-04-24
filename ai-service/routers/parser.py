from fastapi import APIRouter, UploadFile, File, HTTPException
import io
import PyPDF2
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from openai import AsyncOpenAI
from dotenv import load_dotenv

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from models.schemas import ResumeParseRes

load_dotenv()

# Groq is OpenAI-compatible; keep base URL configurable for future providers.
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY", ""),
    base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
)


def _candidate_models():
    configured = os.getenv("GROQ_MODEL", "").strip()
    defaults = [
        "llama-3.1-8b-instant",
        "llama-3.1-70b-versatile",
        "llama3-70b-8192",
        "mixtral-8x7b-32768",
    ]
    return [configured] + defaults if configured else defaults

router = APIRouter(prefix="/parser", tags=["Parser"])

KNOWN_SKILLS = [
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "node.js", "express", "fastapi", "django", "flask", "spring boot",
    "mongodb", "postgresql", "mysql", "redis", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "jenkins", "github actions",
    "rest", "graphql", "microservices", "system design", "sql", "nosql",
    "pandas", "numpy", "scikit-learn", "machine learning", "llm", "nlp",
    "pytest", "jest", "cypress", "selenium", "git", "linux"
]


def _extract_text_from_pdf(content: bytes) -> str:
    if fitz:
        doc = fitz.open(stream=content, filetype="pdf")
        text_parts = [page.get_text("text") for page in doc]
        doc.close()
        return "\n".join(text_parts)

    # Fallback for environments where PyMuPDF is not installed
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    return "\n".join([(page.extract_text() or "") for page in reader.pages])


def _extract_text_from_docx(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        xml_data = archive.read("word/document.xml")

    root = ET.fromstring(xml_data)
    text_chunks = [node.text.strip() for node in root.iter() if node.text and node.text.strip()]
    return "\n".join(text_chunks)


def _normalize_skill(skill: str) -> str:
    parts = [w.capitalize() if w.isalpha() else w for w in skill.split(" ")]
    return " ".join(parts)


def _extract_skills_locally(extracted_text: str):
    text_lower = extracted_text.lower()
    found = []
    for skill in KNOWN_SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)"
        if re.search(pattern, text_lower):
            found.append(_normalize_skill(skill))

    # Also include common explicit "Skills:" line values when present
    line_skills = []
    for line in extracted_text.splitlines():
        if "skill" in line.lower() and ":" in line:
            candidates = re.split(r"[,|/]", line.split(":", 1)[1])
            for candidate in candidates:
                token = candidate.strip()
                if 2 < len(token) < 40:
                    line_skills.append(token)

    deduped = []
    seen = set()
    for skill in found + line_skills:
        key = skill.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(skill)

    return deduped[:40]


def _local_resume_fallback(extracted_text: str):
    skills = _extract_skills_locally(extracted_text)

    return ResumeParseRes(
        skills=skills if skills else ["General Software Engineering"],
        projects=[],
        experience=[],
        education=[]
    )

@router.post("/resume", response_model=ResumeParseRes)
async def parse_resume(file: UploadFile = File(...)):
    """
    Parses a PDF or DOCX file, extracts text, and conceptually sends it to an LLM 
    to extract structured JSON for: skills, projects, experience, and education.
    """
    if not file.filename.endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    content = await file.read()
    extracted_text = ""

    try:
        # Prefer PyMuPDF for better layout fidelity; fallback to PyPDF2.
        if file.filename.endswith(".pdf"):
            extracted_text = _extract_text_from_pdf(content)
        elif file.filename.endswith(".docx"):
            extracted_text = _extract_text_from_docx(content)
        
        # Check if Groq API key is configured
        if client.api_key and client.api_key != "your_groq_api_key_here":
            schema_instruction = """
            You are an expert HR AI logic system. Extract the requested fields from the given resume text.
            Always return pure JSON matching this exact structure:
            {
              "skills": ["<skill 1>", "<skill 2>"],
              "projects": [
                { "name": "...", "description": "...", "technologies": ["..."] }
              ],
              "experience": [
                { "company": "...", "role": "...", "duration": "...", "description": "..." }
              ],
              "education": [
                { "institution": "...", "degree": "...", "year": "..." }
              ]
            }
            Do not include Markdown formatting or code blocks outside the JSON string.
            """
            last_llm_error = None

            for model_name in _candidate_models():
                try:
                    completion = await client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": schema_instruction},
                            {"role": "user", "content": f"Resume Text:\n{extracted_text}"}
                        ],
                        response_format={"type": "json_object"}
                    )

                    parsed_json = json.loads(completion.choices[0].message.content)
                    return ResumeParseRes(**parsed_json)
                except Exception as llm_error:
                    last_llm_error = llm_error

            # If all remote models fail (deprecation, quota, provider outage),
            # continue with local fallback instead of failing the upload route.
            if last_llm_error:
                print(f"LLM parsing unavailable, using local fallback: {last_llm_error}")
        
        # Local NLP fallback avoids hardcoded hallucinations if remote LLM is unavailable.
        return _local_resume_fallback(extracted_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")