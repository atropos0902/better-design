FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages packages
RUN npm ci --workspace @conform/service --include-workspace-root && npm run build -w @conform/service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libc++1 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY --from=build /app/node_modules/@cloudflare/workerd-linux-64/bin/workerd /usr/local/bin/workerd
COPY --from=build /app/packages/service/dist packages/service/dist
COPY deploy/workerd.capnp deploy/workerd.capnp
USER nobody
EXPOSE 8787
CMD ["workerd", "serve", "deploy/workerd.capnp"]
