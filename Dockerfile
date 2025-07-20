FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install
RUN apt-get update && apt-get install ffmpeg mp4box
COPY src .

EXPOSE 8080

CMD ["npm", "run", "dev-srv"]