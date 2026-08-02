# =============================================================================
# JobSpy Sidecar Dockerfile - FastAPI service wrapping python-jobspy
# Optimized for production: minimal image, proper signal handling, non-root user
# =============================================================================

FROM python:3.12-slim AS runtime

# Install system dependencies
# curl for health checks, tini for proper signal handling
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r jobspy && useradd -r -g jobspy jobspy

WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Change ownership to non-root user
RUN chown -R jobspy:jobspy /app

# Switch to non-root user
USER jobspy

# Bind 0.0.0.0 inside the container network namespace
ENV JOBSPY_HOST=0.0.0.0
ENV JOBSPY_PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Use tini to handle signals properly (PID 1 problem)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
