// Mounts `WS /agent` on the server: checks the handshake, then hands messages to ingest.
import type { CollectorServer } from '../server/app';
import type { Ingest } from './ingest';

export function registerAgentRoute(server: CollectorServer, ingest: Ingest): void {
  server.app.get('/agent', { websocket: true }, (socket, request) => {
    if (!server.admitSocket(socket, request.headers, 'agent')) return;
    const connection = ingest.accept({
      send: (data) => socket.send(data),
      close: (code, reason) => socket.close(code, reason),
    });
    socket.on('message', (data: Buffer) => connection.onMessage(data));
    socket.on('close', connection.onClose);
  });
}
