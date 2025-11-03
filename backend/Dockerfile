# ============================
# Dockerfile for Backend (Node 22)
# ============================

FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    python3 \
    py3-pip \
    docker-cli \
    netcat-openbsd

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install Node.js dependencies (production only)
RUN npm ci --only=production

# Copy the rest of the app
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port for the API
EXPOSE 5000

# Default command — can be overridden by docker-compose
CMD ["node", "index.js"]
