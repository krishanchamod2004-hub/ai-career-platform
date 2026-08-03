# =============================================================================
# JobSpy FastAPI Microservice - Production Dockerfile
# =============================================================================
# Build: docker build -f services/jobspy/Dockerfile -t your-registry/ai-career-jobspy:latest services/jobspy
# Push:  docker push your-registry/ai-career-jobspy:latest
# Run:   docker run -p 8000:8000 your-registry/ai-career-jobspy:latest
# =============================================================================

FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        tini \
        gcc \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r jobspy && useradd -r -g jobspy jobspy

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Change ownership to non-root user
RUN chown -R jobspy:jobspy /app

# Switch to non-root user
USER jobspy

# Environment variables
ENV JOBSPY_HOST=0.0.0.0
ENV JOBSPY_PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Use tini for proper signal handling (handles PID 1 responsibilities)
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
