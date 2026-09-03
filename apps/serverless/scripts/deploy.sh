#!/usr/bin/env bash

set -euo pipefail

# Do not leak sourced secrets or expanded deploy arguments if the caller
# enabled Bash tracing. Restore the caller's tracing state when we exit.
xtrace_was_enabled=0
case $- in
  *x*)
    xtrace_was_enabled=1
    set +x
    ;;
esac

restore_xtrace() {
  if ((xtrace_was_enabled)); then
    set -x
  fi
}
trap restore_xtrace EXIT

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
  LAMBDA_PROXY_SECRET
  ALLOWED_ORIGINS
  GEMINI_API_KEY
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  MISTRAL_API_KEY
  DEEPSEEK_API_KEY
  OPENROUTER_API_KEY
)

for variable in "${required_vars[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required variable in apps/serverless/.env: $variable" >&2
    exit 1
  fi
done

IFS=',' read -r -a allowed_origins <<< "$ALLOWED_ORIGINS"
for origin in "${allowed_origins[@]}"; do
  if [[ ! "$origin" =~ ^https://[^[:space:]]+$ && ! "$origin" =~ ^http://localhost(:[0-9]+)?$ ]]; then
    echo "ALLOWED_ORIGINS must contain HTTPS origins or localhost HTTP origins; wildcard '*' is not allowed" >&2
    exit 1
  fi
done

pnpm run build

sam deploy \
  --parameter-overrides \
  "PORT=${PORT}" \
  "ClerkIssuerBaseURL=${CLERK_ISSUER_BASE_URL}" \
  "ClerkAuthorizedParties=${CLERK_AUTHORIZED_PARTIES}" \
  "LambdaProxySecret=${LAMBDA_PROXY_SECRET}" \
  "GeminiAPIKey=${GEMINI_API_KEY}" \
  "OpenAIAPIKey=${OPENAI_API_KEY}" \
  "AnthropicAPIKey=${ANTHROPIC_API_KEY}" \
  "MistralAPIKey=${MISTRAL_API_KEY}" \
  "DeepSeekAPIKey=${DEEPSEEK_API_KEY}" \
  "OpenRouterAPIKey=${OPENROUTER_API_KEY}" \
    "AllowedOrigins=${ALLOWED_ORIGINS:-*}"

rm -rf dist/*
