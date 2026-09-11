# syntax=docker/dockerfile:1

FROM node:26.8-alpine3.24 AS build

WORKDIR /workspace

COPY package.json package-lock.json ./

RUN npm install --global npm@11.6.0 \
    && npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:26.8-alpine3.24 AS runtime

RUN addgroup -S simulator \
    && adduser -S -G simulator -h /app simulator

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --global npm@11.6.0 \
    && npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build --chown=simulator:simulator /workspace/dist ./dist

USER simulator

CMD ["node", "dist/index.js"]