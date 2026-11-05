import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export interface ProfileServer {
  url: string;
  server: Server;
}

// Stands in for a third-party API so the axios call is real HTTP but stays on
// this machine (CLAUDE.md: no data off the machine).
export function startProfileServer(): Promise<ProfileServer> {
  const server = createServer((req, res) => {
    const match = /^\/profiles\/(\d+)$/.exec(req.url ?? '');
    if (req.method !== 'GET' || !match) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    const userId = Number(match[1]);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ userId, bio: `Fixture profile for user ${userId}`, followers: 42 }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}
