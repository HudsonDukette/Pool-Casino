FROM node:20-alpine

WORKDIR /workspace

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifest files for workspace install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy rest of repo
COPY . .

# Install deps and build only the api-server package
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
