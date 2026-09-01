#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

if [[ ! -f .env ]]; then
  echo "Missing apps/serverless/.env" >&2
  exit 1
fi

set -a
source .env
set +a

required_vars=(
  PORT
  CLERK_ISSUER_BASE_URL
  CLERK_AUTHORIZED_PARTIES
  GEMINI_API_KEY
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  MISTRAL_API_KEY
  DEEPSEEK_API_KEY
)

for variable in "${required_vars[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required variable in apps/serverless/.env: $variable" >&2
    exit 1
  fi
done

pnpm run build

sam deploy \
  --parameter-overrides \
  "PORT=${PORT}" \
  "ClerkIssuerBaseURL=${CLERK_ISSUER_BASE_URL}" \
  "ClerkAuthorizedParties=${CLERK_AUTHORIZED_PARTIES}" \
  "GeminiAPIKey=${GEMINI_API_KEY}" \
  "OpenAIAPIKey=${OPENAI_API_KEY}" \
  "AnthropicAPIKey=${ANTHROPIC_API_KEY}" \
  "MistralAPIKey=${MISTRAL_API_KEY}" \
  "DeepSeekAPIKey=${DEEPSEEK_API_KEY}" \
    "AllowedOrigins=${ALLOWED_ORIGINS:-*}"

rm -rf dist/*
