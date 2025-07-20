docker-compose down
docker rm $(docker ps -aq)
docker rmi -f $(docker images -q)
docker volume rm $(docker volume ls -q)
docker network rm $(docker network ls -q)
docker system prune -af --volumes
docker-compose up --build