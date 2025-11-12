# Backend-Only Codespace Configuration
FROM node:20-alpine

# Install PostgreSQL client and tools
RUN apk add --no-cache git bash curl postgresql-client

# Set working directory
WORKDIR /workspace

# Copy backend-related files
COPY server/ ./server/
COPY shared/ ./shared/
COPY docs/backend/ ./docs/
COPY package.json ./

# Install dependencies
RUN npm install

# Setup backend environment
ENV NODE_ENV=development
ENV BACKEND_ONLY=true

# Expose ports for API and database
EXPOSE 3001 5432

# Default command
CMD ["npm", "run", "backend:dev"]
