// Mounts `WS /live` on the server: checks the handshake, then hands the socket to the hub.
import type { CollectorServer } from '../server/app';
import type { LiveHub } from './hub';

export function registerLiveRoute(server: CollectorServer, hub: LiveHub): void {
  server.app.get('/live', { websocket: true }, (socket, request) => {
    if (!server.admitSocket(socket, request.headers, 'live')) return;
    const connection = hub.accept({
      send: (data) => socket.send(data),
      close: (code, reason) => socket.close(code, reason),
    });
    socket.on('message', (data: Buffer) => connection.onMessage(data));
    socket.on('close', connection.onClose);
  });
}
