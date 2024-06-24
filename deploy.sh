#!/bin/bash

# Instalar dependências
cd /home/henrique/web-henrique/rtps-cam-stream/client
npm install

cd /home/henrique/web-henrique/rtps-cam-stream/server
npm install

# Gerenciar processos com pm2
pm2 delete rtsp-cam-stream-server || true
pm2 delete rtsp-cam-stream-client || true

# Iniciar server
cd /home/henrique/web-henrique/rtps-cam-stream/server
pm2 start server.js --name "rtsp-cam-stream-server"

# Iniciar client
cd /home/henrique/web-henrique/rtps-cam-stream/client
pm2 start npm --name "rtsp-cam-stream-client" -- start

# Salvar lista de processos
pm2 save

# Mostrar lista de processos
pm2 list