FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3006

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3006/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
