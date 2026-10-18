#!/usr/bin/env bash
# ==============================================================================
# RaahGo Production Startup Script
# ==============================================================================
# Usage:
#   ./start.sh          -> Run migrations, collectstatic, Daphne web server & workers
#   ./start.sh web      -> Run only Daphne ASGI web server (HTTP + WebSockets)
#   ./start.sh matching -> Run only the ride-matching background worker
#   ./start.sh outbox   -> Run only the transactional outbox polling worker
#   ./start.sh migrate  -> Run only database migrations & collectstatic
# ==============================================================================

set -eo pipefail

# Project Root Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Load Environment Variables from .env if present
if [ -f ".env" ]; then
    echo "[*] Loading environment variables from .env..."
    # Export non-comment lines
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
else
    echo "[!] Warning: No .env file found. Using default/system environment variables."
fi

# 2. Activate Python Virtual Environment
if [ -d "venv" ]; then
    echo "[*] Activating virtual environment (venv)..."
    # shellcheck disable=SC1091
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "[*] Activating virtual environment (.venv)..."
    # shellcheck disable=SC1091
    source .venv/bin/activate
elif [ -n "$VIRTUAL_ENV" ]; then
    echo "[*] Using active virtual environment: $VIRTUAL_ENV"
else
    echo "[!] No virtual environment found. Using system Python: $(which python3 || which python)"
fi

PYTHON_BIN="$(which python3 || which python)"
DAPHNE_BIN="$(which daphne || echo "")"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

# 3. Database Migration and Static Files Function
run_migrations_and_static() {
    echo "[*] Running database migrations..."
    "$PYTHON_BIN" manage.py migrate --noinput

    echo "[*] Collecting static files..."
    "$PYTHON_BIN" manage.py collectstatic --noinput
}

# 4. Mode Selection
MODE="${1:-all}"

case "$MODE" in
    migrate)
        run_migrations_and_static
        echo "[✓] Migrations & static files collected successfully."
        exit 0
        ;;

    web)
        run_migrations_and_static
        echo "[*] Starting Daphne ASGI server on ${HOST}:${PORT}..."
        exec daphne -b "$HOST" -p "$PORT" project.asgi:application
        ;;

    matching)
        echo "[*] Starting RaahGo Ride Matching Worker..."
        exec "$PYTHON_BIN" manage.py run_matching_worker
        ;;

    outbox)
        echo "[*] Starting RaahGo Outbox Worker..."
        exec "$PYTHON_BIN" manage.py process_outbox
        ;;

    all)
        run_migrations_and_static

        echo "=========================================================="
        echo " Starting RaahGo Full Stack (Web + Background Workers)"
        echo "=========================================================="

        # PIDs to track for graceful shutdown
        PIDS=()

        cleanup() {
            echo ""
            echo "[*] Shutting down all RaahGo services..."
            for pid in "${PIDS[@]}"; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill -TERM "$pid" 2>/dev/null || true
                fi
            done
            wait
            echo "[✓] All processes stopped."
            exit 0
        }

        trap cleanup SIGINT SIGTERM EXIT

        # Start Matching Worker in background
        echo "[1/3] Starting Ride Matching Background Worker..."
        "$PYTHON_BIN" manage.py run_matching_worker &
        PIDS+=($!)

        # Start Outbox Worker in background
        echo "[2/3] Starting Outbox Event Worker..."
        "$PYTHON_BIN" manage.py process_outbox &
        PIDS+=($!)

        # Start Daphne ASGI Server
        echo "[3/3] Starting Daphne ASGI Server on ${HOST}:${PORT}..."
        daphne -b "$HOST" -p "$PORT" project.asgi:application &
        PIDS+=($!)

        echo "[✓] All RaahGo services running. Press Ctrl+C to stop."

        # Wait for any process to exit
        wait -n "${PIDS[@]}"
        cleanup
        ;;

    *)
        echo "Usage: $0 {all|web|matching|outbox|migrate}"
        exit 1
        ;;
esac
