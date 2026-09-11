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

RUN apk add --no-cache wget \
    && addgroup -S mqttapp \
    && adduser -S -G mqttapp -h /app mqttapp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --global npm@11.6.0 \
    && npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build --chown=mqttapp:mqttapp /workspace/dist ./dist

USER mqttapp

EXPOSE 8090

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 \
    CMD wget -qO- http://127.0.0.1:8090/health >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]