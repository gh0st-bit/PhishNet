#!/usr/bin/env bash
set -euo pipefail

NO_CLEAN=0

usage(){
  cat >&2 <<EOF
Usage: $0 [-f full.dump] [-s schema.sql -a data.sql] -t targetdb -U user -h host [-p port] [--globals globals.sql] [--no-clean] [--no-owner]
Examples:
  $0 -f phishnet_full_20250828_181748.dump -t phishnet_restored -U postgres -h localhost
  $0 -s phishnet_schema_20250828_181748.sql -a phishnet_data_20250828_181748.sql -t phishnet_restored -U postgres -h localhost
EOF
  exit 1
}

FULL=""; SCHEMA=""; DATA=""; TARGET=""; USERNAME=""; HOST=""; PORT=5432; GLOBALS=""; PASSWORD=""; NOOWNER=0

while [[ $# -gt 0 ]]; do
  case $1 in
    -f)
      [[ $# -lt 2 ]] && { echo "Missing value for -f" >&2; usage; }
      FULL=$2; shift 2;;
    -s)
      [[ $# -lt 2 ]] && { echo "Missing value for -s" >&2; usage; }
      SCHEMA=$2; shift 2;;
    -a)
      [[ $# -lt 2 ]] && { echo "Missing value for -a" >&2; usage; }
      DATA=$2; shift 2;;
    -t)
      [[ $# -lt 2 ]] && { echo "Missing value for -t" >&2; usage; }
      TARGET=$2; shift 2;;
    -U)
      [[ $# -lt 2 ]] && { echo "Missing value for -U" >&2; usage; }
      USERNAME=$2; shift 2;;
    -h)
      [[ $# -lt 2 ]] && { echo "Missing value for -h" >&2; usage; }
      HOST=$2; shift 2;;
    -p)
      [[ $# -lt 2 ]] && { echo "Missing value for -p" >&2; usage; }
      PORT=$2; shift 2;;
    --globals)
      [[ $# -lt 2 ]] && { echo "Missing value for --globals" >&2; usage; }
      GLOBALS=$2; shift 2;;
    -w)
      [[ $# -lt 2 ]] && { echo "Missing value for -w" >&2; usage; }
      PASSWORD=$2; export PGPASSWORD=$PASSWORD; shift 2;;
    --no-owner) NOOWNER=1; shift;;
    --no-clean) NO_CLEAN=1; shift;;
    *) usage;;
  esac
done

[[ -z "$TARGET" || -z "$USERNAME" || -z "$HOST" ]] && usage

if [[ -n "$FULL" && ( -n "$SCHEMA" || -n "$DATA" ) ]]; then
  echo "Use either -f OR (-s -a)." >&2; exit 1;
fi

# Restore globals first if provided
if [[ -n "$GLOBALS" ]]; then
  echo "Restoring globals: $GLOBALS" >&2
  psql -U "$USERNAME" -h "$HOST" -p "$PORT" -f "$GLOBALS"
fi

psql -U "$USERNAME" -h "$HOST" -p "$PORT" -c "DROP DATABASE IF EXISTS \"$TARGET\";"
psql -U "$USERNAME" -h "$HOST" -p "$PORT" -c "CREATE DATABASE \"$TARGET\";"

if [[ -n "$FULL" ]]; then
  [[ ! -f "$FULL" ]] && { echo "Full dump file not found: $FULL" >&2; exit 1; }
  echo "Restoring full custom dump: $FULL" >&2
  args=( -U "$USERNAME" -h "$HOST" -p "$PORT" -d "$TARGET" )
  if [[ $NO_CLEAN -eq 0 ]]; then
    args+=( --clean --if-exists )
  fi
  [[ $NOOWNER -eq 1 ]] && args+=( --no-owner )
  pg_restore "${args[@]}" "$FULL" || {
    echo "pg_restore reported errors. Many DROP failures are safe if objects didn't exist (fresh DB)." >&2
  }
else
  [[ -z "$SCHEMA" || -z "$DATA" ]] && { echo "Need both -s and -a for schema+data restore" >&2; exit 1; }
  [[ ! -f "$SCHEMA" ]] && { echo "Schema file not found: $SCHEMA" >&2; exit 1; }
  [[ ! -f "$DATA" ]] && { echo "Data file not found: $DATA" >&2; exit 1; }
  echo "Loading schema: $SCHEMA" >&2
  psql -U "$USERNAME" -h "$HOST" -p "$PORT" -d "$TARGET" -f "$SCHEMA"
  echo "Loading data: $DATA" >&2
  psql -U "$USERNAME" -h "$HOST" -p "$PORT" -d "$TARGET" -f "$DATA"
fi

echo "Restore complete."
