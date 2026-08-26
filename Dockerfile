FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ .

RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/index.js"]
