# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build-time variables from Dokploy (ARG → ENV for Vite)
ARG VITE_CHAT_WEBHOOK_URL
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV
ENV VITE_CHAT_WEBHOOK_URL=$VITE_CHAT_WEBHOOK_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copiar configuración custom de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build de producción
COPY --from=builder /app/dist /usr/share/nginx/html

# Verificar que los archivos existen (debug)
RUN ls -la /usr/share/nginx/html/

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Healthcheck - permite a Docker/orquestador saber si el contenedor está sano
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
