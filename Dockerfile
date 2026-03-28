FROM node:20-bookworm-slim AS backend-deps

WORKDIR /app/Backend

COPY Backend/package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS partner-builder

WORKDIR /app/PartnerFrontend

ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY PartnerFrontend/package*.json ./
RUN npm ci

COPY PartnerFrontend ./
RUN npm run build

FROM node:20-bookworm-slim AS admin-builder

WORKDIR /app/AdminFrontend

ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_BASE_PATH="/admin"
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

COPY AdminFrontend/package*.json ./
RUN npm ci

COPY AdminFrontend ./
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_INTERNAL_PORT=5000
ENV PARTNER_INTERNAL_PORT=5181
ENV ADMIN_INTERNAL_PORT=5182
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_BASE_PATH="/admin"

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor gettext-base ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Backend /app/Backend
COPY Backend/package*.json /app/Backend/
COPY --from=backend-deps /app/Backend/node_modules /app/Backend/node_modules

COPY PartnerFrontend /app/PartnerFrontend
COPY PartnerFrontend/package*.json /app/PartnerFrontend/
RUN cd /app/PartnerFrontend && npm ci --omit=dev
COPY --from=partner-builder /app/PartnerFrontend/.next /app/PartnerFrontend/.next

COPY AdminFrontend /app/AdminFrontend
COPY AdminFrontend/package*.json /app/AdminFrontend/
RUN cd /app/AdminFrontend && npm ci --omit=dev
COPY --from=admin-builder /app/AdminFrontend/.next /app/AdminFrontend/.next

COPY docker/render/nginx.conf.template /etc/nginx/templates/render.conf.template
COPY docker/render/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/render/start-render.sh /usr/local/bin/start-render.sh

RUN chmod +x /usr/local/bin/start-render.sh \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

EXPOSE 10000

CMD ["/usr/local/bin/start-render.sh"]
