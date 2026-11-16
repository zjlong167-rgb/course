FROM node:24.13.0-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend/ frontend/
COPY samples/ samples/
COPY contracts/ contracts/
RUN npm run build
FROM nginx:1.28.2-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/dist /usr/share/nginx/html
EXPOSE 80
