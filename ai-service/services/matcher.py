import math
from typing import List

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude1 = math.sqrt(sum(a * a for a in v1))
    magnitude2 = math.sqrt(sum(b * b for b in v2))
    if not magnitude1 or not magnitude2:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

def keyword_overlap_score(user_skills: List[str], required_skills: List[str]) -> float:
    if not required_skills:
        return 1.0 # 100% matched if no requirements
        
    user_skills_lower = set([s.lower().strip() for s in user_skills])
    req_skills_lower = set([s.lower().strip() for s in required_skills])
    
    match_count = len(user_skills_lower.intersection(req_skills_lower))
    return match_count / len(req_skills_lower)

def evaluate_decision(ats_score: float) -> str:
    if ats_score >= 0.70:
        return "Apply"
    elif ats_score >= 0.50:
        return "Improve"
    else:
        return "Skip"