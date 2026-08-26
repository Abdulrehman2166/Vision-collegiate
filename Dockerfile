FROM node:22-alpine AS build

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ .

RUN npx tsc

RUN npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
