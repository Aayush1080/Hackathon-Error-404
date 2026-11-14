# One image serves everything: public app at /, admin dashboard at /admin, API at /api.
# Stage 1 builds the two websites with Node; stage 2 runs the FastAPI server with Python.

FROM node:22-slim AS web
WORKDIR /build
COPY app/package.json app/package-lock.json app/
COPY admin/package.json admin/package-lock.json admin/
RUN cd app && npm ci --no-audit --no-fund && cd ../admin && npm ci --no-audit --no-fund
COPY app/ app/
COPY admin/ admin/
# No VITE_API_URL: the built sites call the server they are loaded from.
RUN rm -f app/.env admin/.env && cd app && npx vite build && cd ../admin && npx vite build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY server/requirements.txt .
RUN pip install -r requirements.txt
COPY server/ .
RUN rm -f .env
COPY --from=web /build/app/dist site/app
COPY --from=web /build/admin/dist site/admin
RUN useradd --create-home morisafe && chown -R morisafe /srv
USER morisafe
EXPOSE 8000
# Render sets $PORT. Proxy headers so rate limits see the real client IP behind Render's proxy.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
