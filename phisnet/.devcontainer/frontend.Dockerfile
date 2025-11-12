# Frontend-Only Codespace Configuration
FROM node:20-alpine

# Install basic tools
RUN apk add --no-cache git bash curl

# Set working directory
WORKDIR /workspace

# Copy only frontend-related files
COPY client/ ./client/
COPY shared/types/ ./shared/types/
COPY docs/frontend/ ./docs/
COPY package.json ./

# Install dependencies
RUN npm install

# Setup frontend environment
ENV NODE_ENV=development
ENV FRONTEND_ONLY=true

# Expose ports for frontend and API proxy
EXPOSE 3000 3001

# Default command
CMD ["npm", "run", "frontend:dev"]
