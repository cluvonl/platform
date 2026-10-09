FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS deps
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3=3.11.2-1+b1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN npm run typecheck && npm test && npm run build
FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runner
# /app collides with the app/app route during Next's CSS entry detection.
WORKDIR /workspace
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /workspace/.next/standalone ./
COPY --from=build --chown=node:node /workspace/.next/static ./.next/static
COPY --from=build --chown=node:node /workspace/public ./public
COPY --from=build --chown=node:node /workspace/scripts/runtime-guard.mjs ./scripts/runtime-guard.mjs
COPY --from=build --chown=node:node /workspace/scripts/wp0-smoke.mjs ./scripts/wp0-smoke.mjs
COPY --from=build --chown=node:node /workspace/scripts/public-auth-style-smoke.mjs ./scripts/public-auth-style-smoke.mjs
USER node
RUN --network=none node scripts/wp0-smoke.mjs
EXPOSE 3000
CMD ["node","--import","./scripts/runtime-guard.mjs","server.js"]
