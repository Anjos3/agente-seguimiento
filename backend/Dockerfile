FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

# Dev mode: use tsx watch (no build required)
CMD ["npm", "run", "dev"]
