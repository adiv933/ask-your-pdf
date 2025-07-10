FROM node:22.12.0-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000
EXPOSE 6379
EXPOSE 6333

CMD ["sh", "-c", "npm run start & npm run start:worker && wait"]
