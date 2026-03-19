# ── Stage 1: Build ──
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && \
    cp -R node_modules /prod_modules && \
    yarn install --frozen-lockfile
COPY . .
RUN yarn build

# ── Stage 2: Production ──
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3000

USER node

CMD ["node", "dist/server.js"]