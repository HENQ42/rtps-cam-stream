import React, { useEffect } from "react";
import JSMpeg from "@cycjimmy/jsmpeg-player";
import axios from "axios";

const StreamPlayer = () => {
  const urls = [
    "rtsp://admin:adminsara42@192.168.1.7:554/onvif1",
    "rtsp://admin:adminsara42@192.168.1.6:554/onvif1",
    "rtsp://sara:sara4257@192.168.1.19:554/user=sara&password=sara4257&channel=1&stream=0.sdp",
    "rtsp://sara:sara4257@192.168.1.48:554/user=sara&password=sara4257&channel=4&stream=0.sdp",
    "rtsp://sara:sara4257@192.168.1.48:554/user=sara&password=sara4257&channel=4&stream=0.sdp",
  ];

  useEffect(() => {
    urls.forEach((url, index) => {
      axios.get(`http://192.168.1.76:3002/stream?id=${index}`)
        .then(response => {
          let canvas = document.getElementById(`video-canvas-${index}`);
          new JSMpeg.Player(response.data.url, { canvas: canvas });
        })
        .catch(error => {
          console.error(`Error connecting to stream ${index}:`, error);
        });
    });
  }, [urls]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {urls.map((url, index) => (
        <div key={index} style={{ width: '48%', marginBottom: '2%' }}>
          <canvas id={`video-canvas-${index}`} style={{ width: '100%' }}></canvas>
        </div>
      ))}
    </div>
  );
};

export default StreamPlayer;
