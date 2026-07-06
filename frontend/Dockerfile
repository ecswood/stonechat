# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

ARG REACT_APP_BACKEND_URL=http://147.15.57.112:8081
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV GENERATE_SOURCEMAP=false

COPY package*.json ./

RUN npm install --force

COPY . .

RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:stable-alpine

COPY --from=builder /usr/src/app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
