#!/bin/sh

. ./.env

test -n "$DOMAIN" || {
    printf 'No DOMAIN' >&2
    exit 1
}

INPUT=$(cat)
ESCAPED=$(printf '%s' "$INPUT" | jq -Rs .)

curl -X POST "https://$DOMAIN/tcp" -H 'Content-Type: application/json' -d "{\"data\":$ESCAPED}"
