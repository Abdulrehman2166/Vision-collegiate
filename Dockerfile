FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/index.js"]
