FROM node:20-alpine AS build

ARG APP_TARGET=all
ARG VITE_API_BASE_URL=/api
ARG VITE_LOGIN_APP_URL=/login
ARG VITE_USER_APP_URL=/user/dashboard
ARG VITE_OPERATOR_APP_URL=/operator/infra-service

ENV VITE_APP_TARGET=$APP_TARGET
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LOGIN_APP_URL=$VITE_LOGIN_APP_URL
ENV VITE_USER_APP_URL=$VITE_USER_APP_URL
ENV VITE_OPERATOR_APP_URL=$VITE_OPERATOR_APP_URL

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

ARG NGINX_CONF=nginx.conf

COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
