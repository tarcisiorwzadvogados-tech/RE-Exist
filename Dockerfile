# RE-EXIST proxy — Cloud Run / any container host
# Build: docker build -t re-exist .
# Run:   docker run -p 3001:3001 -e GEMINI_API_KEY=xxx re-exist
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm i tsx
COPY --from=build /app/dist ./dist
COPY server.ts ./
EXPOSE 3001
CMD ["npx", "tsx", "server.ts"]
