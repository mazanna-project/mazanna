FROM node:9-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY src ./src

ENV NODE_ENV production

EXPOSE 8080
CMD ["npm", "start"]



