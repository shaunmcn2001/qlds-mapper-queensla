FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ✅ sources are relative to repo root
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# ✅ copy your backend code into the image
COPY backend/app /app/app

ENV PORT=8000
EXPOSE 8000
ENV HTTP_TIMEOUT_SECONDS=120
CMD sh -c 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --timeout-keep-alive ${HTTP_TIMEOUT_SECONDS}'
