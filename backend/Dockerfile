FROM python:3.12-slim

WORKDIR /app

# System-Deps für psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# WORKERS: Anzahl Uvicorn-Worker-Prozesse (Empfehlung: 2× CPU-Cores).
# Wird im Helm-Chart via ConfigMap gesetzt; Default hier = 2.
ENV WORKERS=2

CMD uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS}
