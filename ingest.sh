#!/bin/bash

# ==============================================================================
# ingest.sh - A script to recursively find and ingest files.
#
# This script performs the following actions:
# 1. Creates a manifest of all files in the current directory and subdirectories,
#    excluding specified paths and files (like itself and the prompts/ dir).
# 2. Iterates through the manifest, submitting each file for ingestion.
# 3. Logs the entire process, including successes and failures, to a log file.
# ==============================================================================

# --- Configuration ---
MANIFEST_FILE="file_manifest.txt"
LOG_FILE="ingest.log"
EXCLUDE_DIR="./prompts"
SELF_NAME="ingest.sh"

# --- Initialization ---
# Clear the log file and add a starting timestamp.
echo "===== Ingestion process started at $(date) =====" > "$LOG_FILE"
echo "Script initialized. Manifest: $MANIFEST_FILE, Log: $LOG_FILE" | tee -a "$LOG_FILE"

# --- Step 1: Generate File Manifest ---
echo "Generating file manifest..." | tee -a "$LOG_FILE"

# Find all files (-type f), excluding:
# - Directories with a dot in the name (like .git, .cache, .vscode, etc.)
# - The prompts directory
# - Control files (this script, manifest, log)
find . \( -type d -name ".*" -o -path "$EXCLUDE_DIR" \) -prune -o -type f \
    ! -name "$SELF_NAME" \
    ! -name "$MANIFEST_FILE" \
    ! -name "$LOG_FILE" \
    ! -name ".*" \
    -print > "$MANIFEST_FILE"

# Check if the manifest was created and has content
if [ ! -s "$MANIFEST_FILE" ]; then
    echo "Error: File manifest is empty or could not be created." | tee -a "$LOG_FILE"
    echo "===== Ingestion process failed at $(date) =====" >> "$LOG_FILE"
    exit 1
fi

echo "Manifest created with $(wc -l < "$MANIFEST_FILE") files." | tee -a "$LOG_FILE"

# --- Step 2: Process Files from Manifest ---
echo "Starting file ingestion loop..." | tee -a "$LOG_FILE"

# Read the manifest file line by line
while IFS= read -r filepath; do
    if [ -n "$filepath" ]; then
        echo "Processing: $filepath" | tee -a "$LOG_FILE"

        # Read file content and send to the knowledge ingestion API
        # Supports text files, code files, markdown, and other text-based content
        
        # Get the filename without path
        filename=$(basename "$filepath")
        
        # Read file content (escape for JSON)
        content=$(cat "$filepath" 2>/dev/null | jq -Rs '.')
        
        if [ -z "$content" ] || [ "$content" = '""' ]; then
            echo "  [SKIPPED] Empty or unreadable: $filepath" >> "$LOG_FILE"
            continue
        fi
        
        # Send to the knowledge ingestion API
        response=$(curl -s -X POST "http://localhost:5000/api/knowledge/pipeline/ingest/text" \
            -H "Content-Type: application/json" \
            -d "{\"content\": $content, \"title\": \"$filename\", \"sourceType\": \"codebase\"}" \
            2>&1)
        
        # Check if the response contains success
        if echo "$response" | grep -q '"success":true'; then
            echo "  [SUCCESS] Ingested $filepath" >> "$LOG_FILE"
        else
            echo "  [FAILURE] Failed to ingest $filepath - $response" >> "$LOG_FILE"
        fi
    fi
done < "$MANIFEST_FILE"

# --- Step 3: Cleanup ---
echo "Cleaning up temporary files..." | tee -a "$LOG_FILE"
rm "$MANIFEST_FILE"
echo "Removed manifest file: $MANIFEST_FILE" | tee -a "$LOG_FILE"

# --- Completion ---
echo "===== Ingestion process completed at $(date) =====" >> "$LOG_FILE"
echo "Process finished. See $LOG_FILE for details."

exit 0
