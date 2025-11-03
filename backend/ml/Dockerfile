# ---------- Base image ----------
FROM python:3.10-slim

# ---------- Working directory ----------
WORKDIR /app

# ---------- Install system dependencies ----------
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ---------- Upgrade pip ----------
RUN pip install --no-cache-dir --upgrade pip

# ---------- Install dependencies ----------
RUN pip install --no-cache-dir spacy==3.7.2

# ✅ Download and install spaCy English model directly
RUN pip install --no-cache-dir \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# ---------- Copy both Python scripts ----------
COPY extract_resume.py jd_analysis.py ./

# ---------- Make both scripts executable ----------
RUN chmod +x extract_resume.py jd_analysis.py

# ---------- Verify spaCy installation ----------
RUN python -c "import spacy; nlp = spacy.load('en_core_web_sm'); print('✅ spaCy model loaded successfully')"

# ---------- Default CMD (can be overridden) ----------
# By default, it will run extract_resume.py, but you can override this at runtime
CMD ["python", "-u", "extract_resume.py"]
