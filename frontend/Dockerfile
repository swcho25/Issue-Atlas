# Build from the repository root. Keep the existing Workers build independent.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
# Git hooks belong to the checkout, not an image build; dependency scripts still run.
RUN node -e "const fs=require('node:fs');const p=require('./package.json');delete p.scripts.prepare;fs.writeFileSync('package.json',JSON.stringify(p))"
RUN --mount=type=cache,id=issueatlas-frontend-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY frontend ./frontend
COPY contracts/c2/examples ./contracts/c2/examples
ARG API_BASE_URL=http://backend:8080
ENV API_BASE_URL=${API_BASE_URL} ISSUEATLAS_EC2_BUILD=1
RUN pnpm --filter frontend build && node frontend/scripts/check-standalone.mjs

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
    CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "frontend/server.js"]
