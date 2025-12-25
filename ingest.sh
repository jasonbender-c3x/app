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

# Find all files (-type f), excluding the specified directory and control files.
find . -path "$EXCLUDE_DIR" -prune -o -type f \
    ! -name "$SELF_NAME" \
    ! -name "$MANIFEST_FILE" \
    ! -name "$LOG_FILE" \
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

        #
        # >>> REPLACE THIS BLOCK WITH YOUR ACTUAL INGESTION COMMAND <<<
        #
        # This is a placeholder command. You should replace this with the
        # actual command-line tool or API call to ingest the file.
        # For this example, we'll just simulate it and log the action.
        #
        # Example: my_ingestion_cli --file "$filepath"

        # Simulate the submission command (replace `true` with your actual command)
        true
        
        # Check the exit code of the last command
        if [ $? -eq 0 ]; then
            echo "  [SUCCESS] Ingested $filepath" >> "$LOG_FILE"
        else
            echo "  [FAILURE] Failed to ingest $filepath" >> "$LOG_FILE"
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
