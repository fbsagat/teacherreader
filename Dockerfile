# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY tsconfig.json server.ts ./
COPY src ./src
RUN npx esbuild server.ts --bundle --platform=node --target=node22 --format=esm --packages=external --outfile=server.js

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    API_ONLY=true
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/server.js ./server.js
USER node
EXPOSE 3000
CMD ["node", "server.js"]
