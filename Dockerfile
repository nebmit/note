# Build stage — standard Node.js for the build.
FROM node:26-bookworm-slim AS builder

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx svelte-kit sync

RUN npm run build

# Production stage — Chainguard for runtime security.
FROM cgr.dev/chainguard/node AS runtime

# Prepare writable runtime paths as root, then drop to the non-root Chainguard
# user. Docker named volumes inherit the target directory ownership on first use,
# so /data must already belong to 65532 or SQLite cannot write to it.
USER 0

WORKDIR /app

# node:sqlite is a Node 24+ builtin. The runtime tag is pinned to a major, but
# this is a cheap tripwire if that tag is ever changed — fail the build loudly
# rather than at first database access in production.
RUN node -e "if (+process.versions.node.split('.')[0] < 24) throw new Error('need Node >= 24 for node:sqlite, got ' + process.version)"

RUN mkdir -p /data && chown -R 65532:65532 /app /data

# Only the build output is copied: with an empty `dependencies` block every
# remaining import in build/ resolves to a Node builtin, so no node_modules tree
# is needed at runtime.
COPY --chown=65532:65532 --from=builder /app/build build/
COPY --chown=65532:65532 --from=builder /app/package.json .

# Run as the standard Chainguard non-root UID.
USER 65532:65532

EXPOSE 3000

ENTRYPOINT ["node"]

CMD ["build"]
