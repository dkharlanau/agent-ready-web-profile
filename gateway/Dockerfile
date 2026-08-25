FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY gateway ./gateway
COPY lib ./lib
COPY schema ./schema
ENV ARWP_HTTP_BIND=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "gateway/http-node.mjs"]
