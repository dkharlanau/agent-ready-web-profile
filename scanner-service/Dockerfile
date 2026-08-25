FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bin ./bin
COPY lib ./lib
COPY schema ./schema
COPY scanner-service ./scanner-service
ENV ARWP_SCANNER_BIND=0.0.0.0
ENV PORT=8787
EXPOSE 8787
CMD ["node", "scanner-service/http-node.mjs"]
