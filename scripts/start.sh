#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

MAX_RETRIES=3
RETRY_COUNT=0
HEALTH_CHECK_URL="http://localhost:5000/api/version"
HEALTH_CHECK_TIMEOUT=30

while true; do
    echo "[$(date)] Starting calendar application..."
    npm start &
    APP_PID=$!

    sleep 5

    HEALTHY=false
    for i in $(seq 1 $HEALTH_CHECK_TIMEOUT); do
        if curl -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            HEALTHY=true
            RETRY_COUNT=0
            echo "[$(date)] Application started successfully (PID: $APP_PID)"
            break
        fi
        sleep 1
    done

    if [ "$HEALTHY" = false ]; then
        echo "[$(date)] WARNING: Health check failed after ${HEALTH_CHECK_TIMEOUT}s"
        RETRY_COUNT=$((RETRY_COUNT + 1))

        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "[$(date)] ERROR: Max retries reached. Attempting rollback..."
            kill $APP_PID 2>/dev/null
            wait $APP_PID 2>/dev/null

            BACKUP_DIR="$APP_DIR/.update-backups"
            if [ -d "$BACKUP_DIR" ]; then
                LATEST_BACKUP=$(ls -1d "$BACKUP_DIR"/backup-* 2>/dev/null | sort -r | head -1)
                if [ -n "$LATEST_BACKUP" ]; then
                    echo "[$(date)] Rolling back from: $LATEST_BACKUP"
                    for item in "$APP_DIR"/*; do
                        basename=$(basename "$item")
                        case "$basename" in
                            .env|data|node_modules|.update-backups|.update-temp|.git|.replit|replit.nix|replit.md)
                                continue
                                ;;
                            *)
                                rm -rf "$item"
                                ;;
                        esac
                    done
                    for item in "$LATEST_BACKUP"/*; do
                        basename=$(basename "$item")
                        if [ "$basename" != "version.txt" ]; then
                            cp -r "$item" "$APP_DIR/"
                        fi
                    done
                    echo "[$(date)] Rollback complete. Reinstalling dependencies and rebuilding..."
                    npm install 2>/dev/null
                    npm run build 2>/dev/null
                    RETRY_COUNT=0
                    echo "[$(date)] Restarting with rolled-back version..."
                    continue
                fi
            fi
            echo "[$(date)] No backup available for rollback. Waiting 60s before retry..."
            sleep 60
            RETRY_COUNT=0
            continue
        fi
    fi

    wait $APP_PID
    EXIT_CODE=$?
    echo "[$(date)] Application exited with code: $EXIT_CODE"

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Clean exit (likely update restart). Restarting in 2s..."
        sleep 2
    else
        echo "[$(date)] Unexpected exit. Restarting in 5s..."
        sleep 5
    fi
done
