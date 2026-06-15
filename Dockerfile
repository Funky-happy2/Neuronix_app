# Neuronix production image — used by Koyeb (and any container host).
# Single stage keeps it simple; the server bundle externalizes most
# node_modules, so production deps must remain present at runtime.
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build client (dist/public) + server (dist/index.cjs)
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Koyeb injects PORT (default 8000); server reads process.env.PORT.
EXPOSE 8000

CMD ["node", "dist/index.cjs"]
