#!/usr/bin/env python3
import sys
import json
import re
import spacy

nlp = spacy.load("en_core_web_sm")

SKILL_KEYWORDS = {
    "Python", "JavaScript", "Java", "C++", "Node.js", "React", "AWS", "Docker",
    "SQL", "MongoDB", "Machine Learning", "AI", "Kubernetes", "Flask", "Django",
    "Data Science", "TensorFlow", "HTML", "CSS", "Git", "Agile"
}

def extract_skills_from_jd(text):
    found_skills = []
    text_lower = text.lower()
    for skill in SKILL_KEYWORDS:
        if skill.lower() in text_lower:
            found_skills.append(skill)
    return list(set(found_skills))

def analyze_match(resume_skills, jd_skills):
    matched = list(set(resume_skills) & set(jd_skills))
    missing = list(set(jd_skills) - set(resume_skills))
    match_percent = round((len(matched) / len(jd_skills)) * 100, 2) if jd_skills else 0

    tips = []
    if missing:
        tips.append(f"Consider adding these missing skills: {', '.join(missing)}")
    if match_percent < 60:
        tips.append("Your resume might need better alignment with the job requirements.")

    return {
        "matchedSkills": matched,
        "missingSkills": missing,
        "matchScore": match_percent,
        "tips": tips,
        "jdSkills": jd_skills
    }

if __name__ == "__main__":
    data = json.load(sys.stdin)
    jd_text = data.get("job_description", "")
    resume_skills = data.get("resume_skills", [])

    jd_skills = extract_skills_from_jd(jd_text)
    result = analyze_match(resume_skills, jd_skills)
    print(json.dumps(result, indent=2))
