#!/bin/sh
set -e

if [ "${SKIP_MIGRATE}" != "1" ]; then
  retries=30
  attempt=0

  until pnpm db:deploy; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$retries" ]; then
      echo "Nao foi possivel aplicar migrations apos ${retries} tentativas."
      exit 1
    fi
    echo "Aguardando banco de dados... (${attempt}/${retries})"
    sleep 2
  done
fi

if [ "${SEED_ON_START}" = "1" ]; then
  pnpm db:seed || true
fi

exec "$@"
