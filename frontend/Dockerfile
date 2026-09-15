# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=5173
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node frontend/server.mjs ./server.mjs

USER node
EXPOSE 5173
CMD ["node", "server.mjs", "--prod"]
