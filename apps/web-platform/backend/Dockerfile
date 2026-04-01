FROM node:20-alpine

ARG APP_TARGET=all

WORKDIR /app

ENV APP_TARGET=$APP_TARGET

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 4000

CMD ["npm", "start"]
