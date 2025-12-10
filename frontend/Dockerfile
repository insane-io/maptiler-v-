# ============================================
# Multi-stage Dockerfile for React Frontend
# Supports both development and production
# ============================================

# ============================================
# Stage 1: Build stage (for production)
# ============================================
FROM node:20-alpine as build

WORKDIR /app

# Accept build arguments for Vite environment variables
ARG VITE_MAPTILER_KEY
ARG VITE_OPENWEATHER_KEY
ARG VITE_WAQI_TOKEN
ARG VITE_APP_API_URL=http://localhost:8000

# Set environment variables for build process
ENV VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY
ENV VITE_OPENWEATHER_KEY=$VITE_OPENWEATHER_KEY
ENV VITE_WAQI_TOKEN=$VITE_WAQI_TOKEN
ENV VITE_APP_API_URL=$VITE_APP_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ============================================
# Stage 2: Development image (hot reload)
# ============================================
FROM node:20-alpine as development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev)
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Development command with hot reload
CMD ["npm", "start"]

# ============================================
# Stage 3: Production image (Nginx)
# ============================================
FROM nginx:alpine as production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]