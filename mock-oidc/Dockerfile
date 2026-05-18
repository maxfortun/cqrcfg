FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --registry=https://registry.npmjs.org/

COPY server.js ./

EXPOSE 8888

CMD ["node", "server.js"]
