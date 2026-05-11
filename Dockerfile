# syntax=docker/dockerfile:1
FROM --platform=linux/arm64 node:22-alpine3.21 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM --platform=linux/arm64 node:22-alpine3.21 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM --platform=linux/arm64 node:22-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

EXPOSE 3000
CMD ["node", "dist/main"]
