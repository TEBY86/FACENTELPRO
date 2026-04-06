# ─────────────────────────────────────────────
#  Base: Node 20 sobre Debian Bullseye (slim)
#  Compatible con Puppeteer y Railway
# ─────────────────────────────────────────────
FROM node:20-bullseye-slim

# Evitar prompts interactivos en apt
ENV DEBIAN_FRONTEND=noninteractive

# ── Dependencias del sistema para Chromium/Puppeteer ──
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ── Directorio de trabajo ──
WORKDIR /app

# ── Copiar dependencias primero (cache de capas) ──
COPY package*.json ./

# ── Configurar Caché de Puppeteer (CRUCIAL PARA EL BOTUSER) ──
# Esto asegura que Chromium se instale dentro de /app/.cache
# para que luego el usuario botuser tenga permisos para usarlo.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_CACHE_DIR=/app/.cache

# ── Instalar dependencias Node ──
RUN npm install --omit=dev

# ── Copiar el resto del proyecto ──
COPY . .

# ── Variables de entorno (se sobreescriben en Railway) ──
ENV NODE_ENV=production
# ENV TELEGRAM_TOKEN="" # Es mejor poner esto directamente en la plataforma de Railway

# ── Usuario sin privilegios (buena práctica de seguridad) ──
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && chown -R botuser:botuser /app
USER botuser

# ── Comando de inicio (Corregido a entel_bot.js) ──
CMD ["node", "entel_bot.js"]