# Express API (SAD 4.9). Node 18+ per SRS 2.4; runs as the image's non-root user.
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY database ./database
COPY scripts ./scripts

USER node

EXPOSE 5000

# PWM-NF-003. Alpine has busybox wget, not curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:5000/api/health || exit 1

# Bring the database up to date, then replace the shell with the API process so
# it receives stop signals directly.
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/app.js"]
