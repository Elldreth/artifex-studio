# Multi-stage build → tiny Next.js standalone runtime image.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# Next "standalone" output: a self-contained server + traced node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Point this at your Artifex service at runtime, e.g.
#   -e ARTIFEX_URL=http://localhost:7860   (with --network host)
CMD ["node", "server.js"]
