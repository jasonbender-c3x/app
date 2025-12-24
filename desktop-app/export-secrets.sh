#!/bin/bash
# =============================================================================
# EXPORT SECRETS FROM .ENV TO secrets.json
# =============================================================================
#
# This script reads your .env file and creates a secrets.json file.
# Useful for backing up your configuration or transferring to another machine.
#
# Usage:
#   chmod +x export-secrets.sh
#   ./export-secrets.sh
#
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
SECRETS_FILE="$SCRIPT_DIR/secrets.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${GREEN}Exporting .env to secrets.json${NC}"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Check if secrets.json already exists
if [ -f "$SECRETS_FILE" ]; then
    echo -e "${YELLOW}Warning: secrets.json already exists.${NC}"
    read -p "Overwrite? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Convert .env to JSON using Node.js (more reliable than bash for JSON)
node -e "
const fs = require('fs');
const path = require('path');

const envFile = '$ENV_FILE';
const secretsFile = '$SECRETS_FILE';

// Read .env file
const envContent = fs.readFileSync(envFile, 'utf8');

// Parse .env format (KEY=VALUE, one per line)
const secrets = {};
envContent.split('\n').forEach(line => {
    // Skip empty lines and comments
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    // Split on first = only (values may contain =)
    const idx = line.indexOf('=');
    if (idx === -1) return;
    
    const key = line.substring(0, idx).trim();
    let value = line.substring(idx + 1).trim();
    
    // Remove surrounding quotes if present
    if ((value.startsWith('\"') && value.endsWith('\"')) ||
        (value.startsWith(\"'\") && value.endsWith(\"'\"))) {
        value = value.slice(1, -1);
    }
    
    secrets[key] = value;
});

// Write JSON file
fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2) + '\n');

console.log('Exported ' + Object.keys(secrets).length + ' secrets to secrets.json');
"

# Set secure permissions
chmod 600 "$SECRETS_FILE"

echo ""
echo -e "${GREEN}Done! secrets.json created with secure permissions (600)${NC}"
echo ""
echo -e "${YELLOW}Important: Keep this file secure and never commit it to git.${NC}"
echo ""
