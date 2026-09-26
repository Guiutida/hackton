FROM node:22-alpine
# curl: o health check padrão do Coolify usa curl dentro do container; sem ele o container fica "unhealthy" e o proxy responde 404
RUN apk add --no-cache curl
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
