# --- Single-stage image ---------------------------------------------------
# The custom server runs the TypeScript entrypoint via tsx at runtime, so the
# source and full dependency tree are kept in the final image. Simple and robust
# for a one-service deploy.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build the Next.js app.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
