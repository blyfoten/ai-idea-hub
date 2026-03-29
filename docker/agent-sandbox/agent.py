#!/usr/bin/env python3
"""
Agent Sandbox — Executes AI tasks in an isolated container.

Reads configuration from environment variables:
  AI_BASE_URL  — OpenAI-compatible API endpoint
  AI_API_KEY   — API key (or "not-needed-for-ollama")
  AI_MODEL     — Model identifier (e.g., llama3.1:8b, mistral, codellama)
  JOB_ID       — Unique job identifier
  JOB_TYPE     — Type of task (MARKET_RESEARCH, CODE_GENERATION, etc.)
  PROMPT       — The prompt to execute (or path via --prompt flag)

Output: JSON to stdout
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from openai import OpenAI


def main():
    parser = argparse.ArgumentParser(description="AI Agent Sandbox")
    parser.add_argument("--prompt", type=str, help="Path to prompt file")
    parser.add_argument("--timeout", type=int, default=300, help="Timeout in seconds")
    args = parser.parse_args()

    # Read configuration
    base_url = os.environ.get("AI_BASE_URL", "http://host.docker.internal:11434/v1")
    api_key = os.environ.get("AI_API_KEY", "not-needed-for-ollama")
    model = os.environ.get("AI_MODEL", "llama3.1:8b")
    job_id = os.environ.get("JOB_ID", "unknown")
    job_type = os.environ.get("JOB_TYPE", "unknown")

    # Read prompt
    if args.prompt and Path(args.prompt).exists():
        prompt = Path(args.prompt).read_text()
    elif os.environ.get("PROMPT"):
        prompt = os.environ["PROMPT"]
    else:
        print(json.dumps({"error": "No prompt provided"}))
        sys.exit(1)

    log(f"Agent starting — job={job_id} type={job_type} model={model}")
    log(f"Using API at {base_url}")

    client = OpenAI(base_url=base_url, api_key=api_key)

    start = time.time()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=4096,
            timeout=args.timeout,
        )

        content = response.choices[0].message.content or "{}"
        duration = time.time() - start

        # Try to parse as JSON
        try:
            # Extract JSON from potential markdown wrapping
            import re
            json_match = re.search(r"\{[\s\S]*\}", content)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(content)
        except json.JSONDecodeError:
            result = {"raw_response": content}

        log(f"Completed in {duration:.1f}s")

        # Output result as JSON to stdout
        output = {
            "success": True,
            "job_id": job_id,
            "job_type": job_type,
            "model": model,
            "result": result,
            "duration_seconds": round(duration, 2),
            "tokens_used": getattr(response.usage, "total_tokens", None),
        }
        print(json.dumps(output))

    except Exception as e:
        duration = time.time() - start
        log(f"FAILED after {duration:.1f}s: {e}")

        output = {
            "success": False,
            "job_id": job_id,
            "job_type": job_type,
            "error": str(e),
            "duration_seconds": round(duration, 2),
        }
        print(json.dumps(output))
        sys.exit(1)


def log(msg: str):
    """Log to stderr so stdout stays clean for JSON output."""
    print(f"[agent] {msg}", file=sys.stderr)


if __name__ == "__main__":
    main()
