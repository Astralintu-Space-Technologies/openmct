# Multi-stage build: compile the static bundle, then serve it with nginx.
# Matches antenna-controller's pattern of one Dockerfile per app, run via
# docker-compose with different commands/images per service.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time git-revision lookup (webpack.common.mjs) fails harmlessly here —
# no git binary, and .git is excluded from the build context on purpose to
# keep layer caching stable across commits — falling back to a placeholder
# version string in the About dialog. Not worth trading that caching for.
RUN npm run build:prod

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
