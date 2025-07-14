### build ###
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

### runtime ###
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Debug: Check environment variables first
# CMD ["node", "debug-env.js"]
CMD ["node", "dist/http-wrapper.js"]