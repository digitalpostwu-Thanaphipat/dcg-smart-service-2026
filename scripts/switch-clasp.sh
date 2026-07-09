#!/bin/bash
# switch-clasp.sh - สลับ .clasp.json ระหว่าง staging/production
# ใช้: ./scripts/switch-clasp.sh [staging|production]

set -e

MODE=${1:-""}

if [ "$MODE" != "staging" ] && [ "$MODE" != "production" ]; then
  echo "Usage: $0 [staging|production]"
  echo ""
  echo "Examples:"
  echo "  $0 staging      # สลับไป staging"
  echo "  $0 production   # สลับกลับ production"
  exit 1
fi

# Backup current .clasp.json
if [ -f .clasp.json ]; then
  cp .clasp.json .clasp.backup.json
fi

if [ "$MODE" = "staging" ]; then
  if [ ! -f .clasp.staging.json ]; then
    echo "Error: .clasp.staging.json not found"
    echo "Please create it with your staging script ID"
    exit 1
  fi
  
  # Check if staging script ID is set
  if grep -q "PUT_STAGING_SCRIPT_ID_HERE" .clasp.staging.json; then
    echo "Error: Please update .clasp.staging.json with your staging script ID first"
    exit 1
  fi
  
  cp .clasp.staging.json .clasp.json
  echo "✅ Switched to STAGING"
  echo "   Script ID: $(grep scriptId .clasp.json | cut -d'"' -f4)"
  
else
  if [ -f .clasp.production.json ]; then
    cp .clasp.production.json .clasp.json
  elif [ -f .clasp.backup.json ]; then
    cp .clasp.backup.json .clasp.json
  else
    echo "Error: No production config found"
    exit 1
  fi
  echo "✅ Switched to PRODUCTION"
  echo "   Script ID: $(grep scriptId .clasp.json | cut -d'"' -f4)"
fi

# Clean up backup
rm -f .clasp.backup.json

echo ""
echo "⚠️  Remember to run 'clasp push' after switching"
