# Agent Sandbox Container
# Isolated environment where AI agents execute tasks
# Constrained: no host network, limited memory/CPU, auto-removed

FROM python:3.12-slim

WORKDIR /app

# Install minimal dependencies for agent work
RUN pip install --no-cache-dir \
    openai \
    httpx \
    pydantic \
    jinja2

# Copy agent script
COPY agent.py /app/agent.py

# Non-root user for security
RUN useradd -m -s /bin/bash agent
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "print('ok')"

ENTRYPOINT ["python", "/app/agent.py"]
