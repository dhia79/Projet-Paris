# syntax=docker/dockerfile:1
# Debian-based image for the one-shot ingestion job.
FROM python:3.12-slim-bookworm

WORKDIR /app

# Dependencies first: cached until requirements.txt changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY paris_pipeline ./paris_pipeline

RUN useradd --system --uid 10001 --no-create-home pipeline
USER pipeline

ENTRYPOINT ["python", "-m", "paris_pipeline.run"]
