#!/usr/bin/env python3
import sys
import json
import re
import spacy
from datetime import datetime

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm"}), file=sys.stderr)
    sys.exit(1)


def extract_contact_info(text):
    """Extract email, phone, and name from resume text"""
    contact = {
        "email": None,
        "phone": None,
        "name": None,
        "linkedin": None,
        "github": None
    }
    
    # Email extraction
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    if emails:
        contact["email"] = emails[0]
    
    # Phone extraction (various formats)
    phone_patterns = [
        r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\d{10}',
    ]
    for pattern in phone_patterns:
        phones = re.findall(pattern, text)
        if phones:
            contact["phone"] = phones[0]
            break
    
    # LinkedIn
    linkedin_match = re.search(r'linkedin\.com/in/([a-zA-Z0-9-]+)', text, re.IGNORECASE)
    if linkedin_match:
        contact["linkedin"] = f"linkedin.com/in/{linkedin_match.group(1)}"
    
    # GitHub
    github_match = re.search(r'github\.com/([a-zA-Z0-9-]+)', text, re.IGNORECASE)
    if github_match:
        contact["github"] = f"github.com/{github_match.group(1)}"
    
    # Name extraction (first PERSON entity, usually at top)
    doc = nlp(text[:500])  # Check only first 500 chars for name
    for ent in doc.ents:
        if ent.label_ == "PERSON" and len(ent.text.split()) <= 4:
            contact["name"] = ent.text
            break
    
    return contact


def extract_skills(text):
    """Extract technical skills from resume"""
    # Expanded skill keywords
    skill_keywords = {
        # Programming Languages
        "Python", "JavaScript", "Java", "C++", "C#", "Ruby", "PHP", "Swift", 
        "Kotlin", "Go", "Rust", "TypeScript", "R", "MATLAB", "Scala", "Perl",
        
        # Web Technologies
        "HTML", "CSS", "React", "Angular", "Vue.js", "Node.js", "Express.js",
        "Django", "Flask", "FastAPI", "Spring Boot", "ASP.NET", "jQuery",
        "Next.js", "Nuxt.js", "Svelte", "Tailwind CSS", "Bootstrap",
        
        # Databases
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Cassandra",
        "Oracle", "SQLite", "DynamoDB", "Firebase", "Neo4j", "MariaDB",
        
        # Cloud & DevOps
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Jenkins", "CI/CD",
        "Terraform", "Ansible", "Git", "GitHub", "GitLab", "Bitbucket",
        "Linux", "Unix", "Shell Scripting", "Bash",
        
        # Data Science & ML
        "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Keras",
        "Scikit-learn", "Pandas", "NumPy", "NLP", "Computer Vision", "AI",
        "Data Analysis", "Statistics", "Tableau", "Power BI", "Spark",
        
        # Mobile Development
        "Android", "iOS", "React Native", "Flutter", "Xamarin",
        
        # Other
        "REST API", "GraphQL", "Microservices", "Agile", "Scrum", "JIRA",
        "Testing", "Unit Testing", "Jest", "Pytest", "Selenium"
    }
    
    # Case-insensitive matching
    found_skills = []
    text_lower = text.lower()
    
    for skill in skill_keywords:
        if skill.lower() in text_lower:
            found_skills.append(skill)
    
    # Remove duplicates and return
    return list(set(found_skills))


def extract_experience(text):
    """Extract work experience from resume"""
    experience = []
    
    # Find experience section
    exp_section = extract_section(text, ["experience", "work history", "employment", "professional experience"])
    
    if not exp_section:
        return experience
    
    # Split by common delimiters (dates, newlines)
    entries = re.split(r'\n(?=\d{4}|\w+\s+\d{4})', exp_section)
    
    for entry in entries:
        if len(entry.strip()) < 20:  # Skip very short entries
            continue
        
        exp_item = {
            "title": None,
            "company": None,
            "duration": None,
            "description": None
        }
        
        # Extract dates
        date_matches = re.findall(r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})', entry, re.IGNORECASE)
        if date_matches:
            exp_item["duration"] = " - ".join(date_matches[:2])
        
        # Use NER to find organizations
        doc = nlp(entry[:300])
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        if orgs:
            exp_item["company"] = orgs[0]
        
        # First line often contains title
        lines = entry.strip().split('\n')
        if lines:
            exp_item["title"] = lines[0].strip()[:100]
        
        exp_item["description"] = entry.strip()[:500]
        
        experience.append(exp_item)
    
    return experience[:5]  # Return max 5 most recent


def extract_education(text):
    """Extract education details from resume"""
    education = []
    
    # Find education section
    edu_section = extract_section(text, ["education", "academic", "qualifications", "degree"])
    
    if not edu_section:
        return education
    
    # Common degree keywords
    degrees = ["Bachelor", "Master", "PhD", "B.Tech", "M.Tech", "B.S.", "M.S.", 
               "BA", "MA", "MBA", "B.E.", "M.E.", "Associate"]
    
    # Split by degree keywords or years
    entries = re.split(r'\n(?=\d{4}|Bachelor|Master|PhD|B\.)', edu_section, flags=re.IGNORECASE)
    
    for entry in entries:
        if len(entry.strip()) < 10:
            continue
        
        edu_item = {
            "degree": None,
            "institution": None,
            "year": None,
            "field": None
        }
        
        # Find degree
        for degree in degrees:
            if degree.lower() in entry.lower():
                edu_item["degree"] = degree
                break
        
        # Extract year
        year_matches = re.findall(r'\b(19\d{2}|20\d{2})\b', entry)
        if year_matches:
            edu_item["year"] = year_matches[-1]  # Most recent year
        
        # Use NER to find institutions
        doc = nlp(entry)
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        if orgs:
            edu_item["institution"] = orgs[0]
        
        education.append(edu_item)
    
    return education[:3]  # Return max 3


def extract_section(text, keywords):
    """Extract a section from resume based on keywords"""
    text_lower = text.lower()
    
    # Find section start
    start_pos = -1
    for keyword in keywords:
        pattern = rf'\b{keyword}\b'
        match = re.search(pattern, text_lower)
        if match:
            start_pos = match.start()
            break
    
    if start_pos == -1:
        return None
    
    # Find section end (next major section or end of text)
    section_headers = ["experience", "education", "skills", "projects", "certifications", 
                      "awards", "summary", "objective", "references"]
    
    end_pos = len(text)
    for header in section_headers:
        pattern = rf'\n\s*\b{header}\b'
        match = re.search(pattern, text_lower[start_pos + 50:])  # Skip current header
        if match:
            potential_end = start_pos + 50 + match.start()
            if potential_end < end_pos:
                end_pos = potential_end
    
    return text[start_pos:end_pos]


def extract_resume_data(text):
    """Main extraction function"""
    try:
        # Extract all components
        contact = extract_contact_info(text)
        skills = extract_skills(text)
        experience = extract_experience(text)
        education = extract_education(text)
        
        # Build result matching worker's expected format
        result = {
            "contact": contact,
            "skills": skills,
            "experience": experience,
            "education": education,
            "summary": {
                "totalSkills": len(skills),
                "totalExperience": len(experience),
                "totalEducation": len(education)
            }
        }
        
        return result
    
    except Exception as e:
        return {
            "error": str(e),
            "skipped": True,
            "reason": f"Extraction failed: {str(e)}"
        }


if __name__ == "__main__":
    try:
        # Read resume text from stdin
        raw_text = sys.stdin.read()
        
        if not raw_text or len(raw_text) < 50:
            print(json.dumps({"error": "Input text too short", "skipped": True}))
            sys.exit(1)
        
        # Extract data
        result = extract_resume_data(raw_text)
        
        # Output as JSON
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e), "skipped": True}), file=sys.stderr)
        sys.exit(1)