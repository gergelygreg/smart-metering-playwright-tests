# syntax=docker/dockerfile:1

FROM node:26.8-alpine3.24 AS build

WORKDIR /workspace

COPY package.json package-lock.json ./

# npm 10.9.8 had an Arborist edgesOut failure in this project on Windows.
# Use the known-good npm version for deterministic container/CI installs.
RUN npm install --global npm@11.6.0 \
    && npm ci

COPY . .

RUN npm run build \
    && mkdir -p /runtime \
    && if [ -d "dist/smart-metering-ui/browser" ]; then \
         cp -a dist/smart-metering-ui/browser/. /runtime/; \
       else \
         cp -a dist/smart-metering-ui/. /runtime/; \
       fi

FROM nginx:stable-alpine3.24 AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /runtime/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1