# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install all dependencies against the committed lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Compile TypeScript sources to dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so only production deps ship in the runtime image.
RUN npm prune --omit=dev

# ---- Production stage ----
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# curl is used by the container healthcheck against the MCP's own /healthz
# (its own unprefixed path, separate from the upstream API's routing).
RUN apk add --no-cache curl

# Copy pruned dependencies, the build output, and the runtime manifest.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json manifest.json ./

# Run as the image's built-in non-root user.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

# The container runs the hosted Streamable HTTP server (not the stdio bin).
CMD ["node", "dist/server-http.js"]
