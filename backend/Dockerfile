# Imagen única para todos los servicios del backend; SERVICE elige cuál ejecutar.
FROM node:22.20.0-alpine
WORKDIR /app/backend
ENV NODE_ENV=production NODE_NO_WARNINGS=1 BIND_HOST=0.0.0.0 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY services ./services
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["sh", "-c", "exec node services/${SERVICE}/index.js"]
