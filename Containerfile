# ---------- Frontend build stage ----------
FROM docker.io/library/node:25-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm install -D @sveltejs/adapter-static
RUN npm run build


# ---------- Final runtime stage ----------
FROM docker.io/library/python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:////app/data/fans.db

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fontconfig \
        fonts-dejavu-core \
        mariadb-client \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY alembic.ini /app/alembic.ini
COPY alembic/ /app/alembic/
COPY templates/ /app/templates/
COPY start_app.sh /app/start_app.sh
RUN mkdir -p /app/data
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
