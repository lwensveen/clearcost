#!/usr/bin/env bash
# Reusable step for cron duty/surcharge/de-minimis imports.
#
# Usage:
#   cron-import-step.sh <label> <api-path> <body-json>
#   cron-import-step.sh <label> <api-path> --env <ENV_VAR> [--body-key <key>]
#
# Examples:
#   cron-import-step.sh "duties:kr-mfn" /internal/cron/import/duties/kr-mfn/official/excel --env KR_MFN_OFFICIAL_EXCEL_URL
#   cron-import-step.sh "duties:jp-mfn" /internal/cron/import/duties/jp-mfn --env JP_TARIFF_INDEX --body-key tariffIndexUrl
#   cron-import-step.sh "vat:auto" /internal/cron/import/vat/auto '{}'
set -euo pipefail

LABEL="$1"
API_PATH="$2"
shift 2

BODY=""
ENV_VAR=""
BODY_KEY="url"

# Parse arguments
if [ "${1:-}" = "--env" ]; then
  ENV_VAR="$2"
  shift 2
  if [ "${1:-}" = "--body-key" ]; then
    BODY_KEY="$2"
    shift 2
  fi
  # Validate env var is set
  VAL="${!ENV_VAR:-}"
  if [ -z "$VAL" ]; then
    echo "[$LABEL] missing $ENV_VAR"
    exit 1
  fi
  BODY=$(jq -n --arg v "$VAL" "{\"$BODY_KEY\": \$v}")
else
  BODY="${1:-{}}"
fi

OUT=$(bun run internal-request -- --path "$API_PATH" --body "$BODY")
echo "$OUT" | jq .

ROWS=$(echo "$OUT" | jq -r '([.count,.inserted,.updated] | map(select(type=="number")) | add) // 0')
if [ "$ROWS" -lt 1 ]; then
  echo "[$LABEL] expected >0 imported rows, got $ROWS"
  exit 1
fi
