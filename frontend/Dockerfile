# The nginx gateway (SAD 4.9): builds the React app, then serves it from nginx.
# The configuration and certificates are mounted by docker-compose.yml.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.28-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
