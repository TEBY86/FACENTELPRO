# ============================================================
# Dockerfile — Bot Factibilidad Entel (Puppeteer + Telegram)
# Compatible con Railway · Optimizado para producción
# ============================================================

FROM node:20-slim

# ── Variables de entorno para Puppeteer ──────────────────────
# CRÍTICO: deben estar definidas ANTES de npm install
# para que puppeteer no descargue su propio Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    DISPLAY=:99

# ── Dependencias del sistema (Chromium + libs) ───────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# ── Verificar que Chromium quedó instalado ───────────────────
RUN chromium --version

# ── Directorio de trabajo ────────────────────────────────────
WORKDIR /app

# ── Copiar package.json primero (caching de capas) ───────────
COPY package*.json ./

# ── Instalar dependencias Node (solo producción) ─────────────
RUN npm ci --omit=dev && npm cache clean --force

# ── Copiar el resto del código ───────────────────────────────
COPY . .

# ── Crear carpeta de imágenes si no existe ───────────────────
RUN mkdir -p imagenes

# ── Usuario no-root por seguridad ────────────────────────────
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && chown -R botuser:botuser /app
USER botuser

# ── Comando de inicio ────────────────────────────────────────
CMD ["node", "index.js"]