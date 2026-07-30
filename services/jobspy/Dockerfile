# JobSpy sidecar — FastAPI service wrapping python-jobspy.
#
# Pinned to Python 3.12: python-jobspy's dependency set (numpy/pandas) has no
# wheels for 3.14 yet and 3.10/3.11 are past the range this repo tests against.
FROM python:3.12-slim AS runtime

WORKDIR /app

# --no-install-recommends keeps the image lean; the sidecar makes outbound HTTPS
# calls only, so no compiler toolchain is needed at runtime (wheels cover all
# pinned deps on this base image).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Bind 0.0.0.0 inside the container network namespace: the service is still
# unreachable from outside because docker-compose does not publish this port to
# the host, and X-JobSpy-Token auth guards every scrape route regardless.
ENV JOBSPY_HOST=0.0.0.0
ENV JOBSPY_PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
