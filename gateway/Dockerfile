FROM nginx:alpine

COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 3006

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/gateway/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
