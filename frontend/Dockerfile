# ============================
# Frontend Dockerfile (Vite)
# ============================

# Use official Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of your code
COPY . .

# Build the app for production
RUN npm run build

# Install lightweight static file server
RUN npm install -g serve

# Expose Vite/Serve default port
EXPOSE 5173

# Command to serve production build
CMD ["serve", "-s", "dist", "-l", "5173"]
