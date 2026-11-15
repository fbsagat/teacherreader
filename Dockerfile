# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
# Lockfile primeiro: cache de camada e build reproduzível (npm ci).
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json server.ts ./
COPY src ./src
# Typecheck e testes rodam no build: uma imagem só existe se o código passa.
# O deploy automático da VPS usa isso como porteiro (falhou → rollback).
RUN npx tsc --noEmit
RUN npx tsx --test "src/utils/*.test.ts"
RUN npx esbuild server.ts --bundle --platform=node --target=node22 --format=esm --packages=external --outfile=server.js

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    API_ONLY=true
# Só dependências de runtime (express, dotenv, @google/genai). Ferramentas de
# frontend ficaram em devDependencies para não inflar a imagem do servidor.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/server.js ./server.js
USER node
EXPOSE 3000
CMD ["node", "server.js"]
