# ---------- Frontend build stage ----------
FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --global npm@latest --no-audit --no-fund
RUN npm ci --prefer-offline --no-audit --no-fund

COPY frontend/ ./
RUN npm run build


# ---------- Final runtime stage ----------
FROM mcr.microsoft.com/devcontainers/python:3.13-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_TIMEZONE=Pacific/Auckland
ENV TZ=Pacific/Auckland

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        chromium-common \
        chromium-sandbox \
        fontconfig \
        fonts-dejavu-core \
        postgresql-client \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --upgrade pip
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY alembic.ini /app/alembic.ini
COPY alembic/ /app/alembic/
COPY templates/ /app/templates/
COPY start_app.sh /app/start_app.sh
RUN mkdir -p /app/frontend/src/lib /app/frontend/scripts
COPY frontend/package*.json /app/frontend/
COPY frontend/scripts/render_product_graph.mjs /app/frontend/scripts/render_product_graph.mjs
COPY frontend/src/lib/fullChart.js /app/frontend/src/lib/fullChart.js
COPY frontend/src/lib/chartTheme.js /app/frontend/src/lib/chartTheme.js
COPY frontend/src/lib/chartStyle.js /app/frontend/src/lib/chartStyle.js
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

EXPOSE 8000

RUN chmod +x /app/start_app.sh

CMD ["/app/start_app.sh"]
