import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function initRealtime(server: HttpServer) {
  if (io) return io;
  io = new SocketIOServer(server, {
    cors: {
      origin: ['http://localhost:5173'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.of('/campaigns').on('connection', (socket) => {
    // In future, authenticate and join org rooms
    socket.on('join-org', (orgId: number) => {
      if (!orgId) return;
      socket.join(`org:${orgId}`);
    });
  });

  return io;
}

export function broadcastCampaignEvent(orgId: number, event: any) {
  if (!io) return;
  io.of('/campaigns').to(`org:${orgId}`).emit('event', event);
}

export function getIO() { return io; }
