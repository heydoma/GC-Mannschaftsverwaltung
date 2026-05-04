# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .

# Vite-Variablen werden zur Build-Zeit ins Bundle eingebettet.
# Werte werden von der CI als --build-arg übergeben.
ARG VITE_API_URL=/api
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=golf-team-manager
ARG VITE_KEYCLOAK_CLIENT_ID=golf-frontend

ENV VITE_API_URL=$VITE_API_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Nginx-Config für SPA (alle Routen → index.html)
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf

# Build-Artefakte aus Stage 1 kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
