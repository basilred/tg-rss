FROM oven/bun:1-alpine AS build-web
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src/web ./src/web
RUN cd src/web && bunx vite build --outDir ../../dist/web

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build-web /app/dist/web ./dist/web
COPY src/server ./src/server
COPY tsconfig.json ./tsconfig.json
COPY src/server/tsconfig.json ./src/server/tsconfig.json

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["bun", "run", "src/server/index.ts"]
