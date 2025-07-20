FROM ubuntu:22.04

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

RUN apt-get update && apt-get install -y ffmpeg wget && \
    wget https://download.tsi.telecom-paristech.fr/gpac/new_builds/linux64/gpac/gpac_2.5-DEV-rev1594-ge02d1fd2-master_amd64.deb && \
    apt-get install -y ./gpac_2.5-DEV-rev1594-ge02d1fd2-master_amd64.deb && \
    rm gpac_2.5-DEV-rev1594-ge02d1fd2-master_amd64.deb && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "dev-srv"]