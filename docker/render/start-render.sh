#!/bin/sh
set -eu

: "${PORT:=10000}"
: "${API_INTERNAL_PORT:=5000}"
: "${PARTNER_INTERNAL_PORT:=5181}"
: "${ADMIN_INTERNAL_PORT:=5182}"

envsubst '${PORT} ${API_INTERNAL_PORT} ${PARTNER_INTERNAL_PORT} ${ADMIN_INTERNAL_PORT}' \
  < /etc/nginx/templates/render.conf.template \
  > /etc/nginx/conf.d/default.conf

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
