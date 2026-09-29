# Образ для production-запуску API
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# Спочатку лише залежності — Docker кешує цей шар, поки package*.json не змінюються
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Запуск від непривілейованого користувача (безпека)
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
