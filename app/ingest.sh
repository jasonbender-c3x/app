#!/bin/bash

# Configuration
MANIFEST_FILE="file_manifest.txt"
LOG_FILE="ingest.log"
````````````
# Function to log messages
log_message() {
    echo "$(date +'%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Initialize
log_message "Script initialized. Manifest: $MANIFEST_FILE, Log: $LOG_FILE"

log_message "Generating file manifest, excluding dot-directories..."

# Corrected find command:
# - Prunes any directory starting with a '.' (like .git, .vscode) to exclude them and their contents.
# - Then prints any item that is a file.
# - Finally, pipes to grep to remove the script's own operational files.
find . \( -type d -name ".*" \) -prune -o -type f -print | grep -vE "^\./(ingest\.sh|${MANIFEST_FILE}|${LOG_FILE})" > "$MANIFEST_FILE"

# Check if the manifest is empty
if [ ! -s "$MANIFEST_FILE" ]; then
    log_message "Manifest is empty. No new files to process. Exiting cleanly."
    exit 0
fi

log_message "Manifest created with $(wc -l < "$MANIFEST_FILE") files listed."

# Process each file from the manifest
while IFS= read -r filepath; do
    if [ -f "$filepath" ]; then
        # Log which file is being processed, but only to the log file to keep console clean
        echo "$(date +'%Y-%m-%d %H:%M:%S') - Processing: $filepath" >> "$LOG_FILE"

        # Simulate ingestion process
        # In a real script, you would call your ingestion tool here, for example:
        # your_ingestion_command --file "$filepath"
    fi
done < "$MANIFEST_FILE"

log_message "Ingestion process completed successfully."

exit 0
