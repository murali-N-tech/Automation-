from fastapi import APIRouter, UploadFile, File, HTTPException
import fitz  # PyMuPDF
import json
import os
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv

from models.schemas import ResumeParseRes

load_dotenv()

# ================= NVIDIA LLM CLIENT =================
# Pointing the AsyncOpenAI client to NVIDIA's API
client = AsyncOpenAI(
    api_key=os.getenv("NVIDIA_API_KEY", ""),
    base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
)

router = APIRouter(prefix="/parser", tags=["Parser"])

@router.post("/resume", response_model=ResumeParseRes)
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename.endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    content = await file.read()
    extracted_text = ""

    try:
        # PRODUCTION FIX: Use PyMuPDF to preserve columns and formatting
        if file.filename.endswith(".pdf"):
            pdf_document = fitz.open(stream=content, filetype="pdf")
            for page in pdf_document:
                extracted_text += page.get_text("text") or ""
        
        # Check if the NVIDIA API key is configured
        if client.api_key and client.api_key != "your_nvidia_api_key_here":
            schema_instruction = """
            You are an expert HR AI logic system. Extract requested fields from the resume text.
            Return pure JSON: { "skills": [], "projects": [], "experience": [], "education": [] }
            """
            
            try:
                completion = await client.chat.completions.create(
                    model="meta/llama-3.1-70b-instruct", # Top-tier model for accurate JSON extraction
                    messages=[
                        {"role": "system", "content": schema_instruction},
                        {"role": "user", "content": f"Resume Text:\n{extracted_text}"}
                    ],
                    response_format={"type": "json_object"}
                )
                parsed_json = json.loads(completion.choices[0].message.content)
                return ResumeParseRes(**parsed_json)
                
            except Exception as llm_error:
                print(f"LLM API failed: {llm_error}. Falling back to Regex extraction.")

        # PRODUCTION FIX: Intelligent Regex Fallback (No hardcoded fake data)
        print("Using local Regex extraction fallback...")
        common_tech_stack = ["Python", "JavaScript", "React", "Node.js", "MongoDB", "Express", "Java", "C++", "AWS", "Docker", "SQL", "FastAPI"]
        
        # Search the text for actual matches, ignore case
        extracted_skills = [skill for skill in common_tech_stack if re.search(r'\b' + re.escape(skill) + r'\b', extracted_text, re.IGNORECASE)]

        return ResumeParseRes(
            skills=list(set(extracted_skills)),
            projects=[], # Fallback limits structure, but prevents hallucination
            experience=[],
            education=[]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")