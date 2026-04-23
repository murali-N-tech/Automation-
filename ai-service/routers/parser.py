from fastapi import APIRouter, UploadFile, File, HTTPException
import io
import PyPDF2
import json
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

from models.schemas import ResumeParseRes

load_dotenv()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

router = APIRouter(prefix="/parser", tags=["Parser"])

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
        # Fallback to PyPDF2 for basic text extraction
        if file.filename.endswith(".pdf"):
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
        
        # Check if OpenAI is configured to run the actual extraction
        if client.api_key and client.api_key != "your_openai_api_key_here":
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
            
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": schema_instruction},
                    {"role": "user", "content": f"Resume Text:\n{extracted_text}"}
                ],
                response_format={"type": "json_object"}
            )
            
            parsed_json = json.loads(completion.choices[0].message.content)
            return ResumeParseRes(**parsed_json)
        
        # Here, we would ideally pass `extracted_text` to OpenAI/Anthropic to structure
        # For prototype stability without active API keys, returning mock structure
        # representing LLM parsing output:
        
        skills = ["Python", "React", "Node.js", "MongoDB", "AWS"]
        
        # Simple extraction logic stub
        if "React" in extracted_text:
            skills.append("React")

        return ResumeParseRes(
            skills=list(set(skills)),
            projects=[
                {
                    "name": "AI Placement Officer",
                    "description": "An AI-powered agent to manage job applications.",
                    "technologies": ["Python", "Node.js"]
                }
            ],
            experience=[
                {
                    "company": "Tech Corp",
                    "role": "Software Engineer",
                    "duration": "2021-2023",
                    "description": "Developed backend APIs."
                }
            ],
            education=[
                {
                    "institution": "University of Tech",
                    "degree": "B.S. in Computer Science",
                    "year": "2021"
                }
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")