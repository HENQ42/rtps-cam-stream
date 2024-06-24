const net = require('net');
const ping = require('ping');
const { networkInterfaces } = require('os');
const async = require('async');
const express = require("express");
const Stream = require("node-rtsp-stream");
const cors = require("cors");
const { exec } = require('child_process');


// Express e configuração do servidor RTSP
const app = express();
const port = 3002;
const streams = {}; // Objeto para armazenar múltiplos streams


function testCameraUrls(ip, callback) {
    const templates = [
        `rtsp://admin:adminsara42@${ip}:554/onvif1`,
        `rtsp://sara:sara4257@${ip}:554/user=sara&password=sara4257&channel=1&stream=0.sdp`
    ];

    let workingUrl = null;

    async.detectSeries(templates, (url, cb) => {
        const ffmpegCommand = `ffmpeg -i "${url}" -t 10 -f null -`;

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.log(error);
                cb(null, false);
            } else {
                workingUrl = url;
                cb(null, true);
            }
        });
    }, (err, result) => {
        callback(workingUrl);
    });
}



// Função para obter o IP local e a máscara de rede
function getLocalNetworkInfo() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return { ip: net.address, mask: net.netmask };
            }
        }
    }
    return null;
}

// Função para gerar todos os IPs na sub-rede
function generateIPs(ip, mask) {
    const subnet = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    const start = subnet.map((part, i) => part & maskParts[i]);
    const end = start.map((part, i) => part | (~maskParts[i] & 255));
    const ips = [];

    for (let a = start[0]; a <= end[0]; a++) {
        for (let b = start[1]; b <= end[1]; b++) {
            for (let c = start[2]; c <= end[2]; c++) {
                for (let d = start[3] + 1; d < end[3]; d++) {
                    ips.push(`${a}.${b}.${c}.${d}`);
                }
            }
        }
    }

    return ips;
}

// Função para verificar se a porta 554 está aberta
function isPortOpen(ip, port, callback) {
    const socket = new net.Socket();
    let status = 'closed';

    socket.setTimeout(5000); // Aumentar o tempo limite de conexão
    socket.on('connect', () => {
        status = 'open';
        socket.destroy();
    });

    socket.on('timeout', () => {
        status = 'closed';
        socket.destroy();
    });

    socket.on('error', () => {
        status = 'closed';
    });

    socket.on('close', () => {
        callback(null, status === 'open');
    });

    socket.connect(port, ip);
}

// Função para escanear a rede
function scanNetwork(callback) {
    const networkInfo = getLocalNetworkInfo();
    if (!networkInfo) {
        return callback(new Error('Não foi possível obter as informações da rede local.'));
    }

    const { ip, mask } = networkInfo;
    const ips = generateIPs(ip, mask);
    const openIPs = [];

    async.eachLimit(ips, 10, (ip, cb) => {
        ping.promise.probe(ip, { timeout: 2 }).then((isAlive) => {
            if (isAlive.alive) {
                // Repetir a verificação 5 vezes para garantir a detecção
                async.retry({ times: 5, interval: 1000 }, (retryCb) => {
                    isPortOpen(ip, 554, (err, open) => {
                        if (open) {
                            openIPs.push(ip);
                            retryCb(null, true);
                        } else {
                            retryCb(null, false);
                        }
                    });
                }, () => {
                    cb();
                });
            } else {
                cb();
            }
        });
    }, (err) => {
        if (err) {
            return callback(err);
        }
        callback(null, openIPs);
    });
}

// Executa a varredura e imprime os resultados
scanNetwork((err, ips) => {
    if (err) {
        return console.error('Erro ao escanear a rede:', err);
    }
    console.log('IPs com porta 554 aberta:', ips);

    ips.forEach((ip, index) => {
        testCameraUrls(ip, (streamUrl) => {
            if (streamUrl) {
                const streamId = index;
                const wsPort = 8999 + streamId;
                streams[streamId] = new Stream({
                    name: `Camera Stream ${streamId}`,
                    streamUrl: streamUrl,
                    wsPort: wsPort,
                    ffmpegOptions: {
                        '-stats': '', // Mostrar progresso no console
                        '-r': 20, // Definir taxa de quadros para 20 fps
                        '-fps_mode': 'cfr', // Método de sincronização de vídeo
                        '-vf': 'scale=960:-1', // Redimensionar vídeo para largura 960, altura automática
                        '-fflags': '+genpts+igndts', // Gerar timestamps e ignorar DTS
                        '-use_wallclock_as_timestamps': '1', // Usar o relógio de parede como timestamps
                        '-async': '1', // Sincronização de áudio
                        '-preset': 'veryfast',
                        '-maxrate': '1M',
                        '-bufsize': '3M',
                        '-g': '40',
                        '-framerate': '20', // Gerar timestamps e ignorar DTS
                        '-c:a': 'aac',
                        '-b:a': '160k',
                        '-ar': '44100',
                    }
                });
            }
        });
    });


});


app.use(
    cors({
        origin: "http://localhost:3002",
        credentials: true,
    })
);

app.get("/stream", (req, res) => {
    const streamId = req.query.id; // Identificador único para cada stream

    if (!streamId || !streams[streamId]) {
        return res.status(400).json({ error: "ID de stream válido é necessário" });
    }

    res.status(200).json({ url: `ws://192.168.1.76:${8999 + parseInt(streamId)}` });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});