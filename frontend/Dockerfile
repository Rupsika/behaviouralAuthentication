# Stage 1: Build the React App
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package requirements and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source files
COPY . .

# Compile TypeScript and build production bundle
RUN npm run build

# Stage 2: Serve production assets with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
