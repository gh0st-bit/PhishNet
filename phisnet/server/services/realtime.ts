import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type { RequestHandler } from 'express';
import { storage } from '../storage';

let io: SocketIOServer | null = null;
export function initRealtime(server: HttpServer, sessionMiddleware: RequestHandler, origins: Set<string>) {
  if (io) return io;
  io = new SocketIOServer(server, { cors: { origin: [...origins], credentials: true }, path: '/socket.io' });
  io.engine.use(sessionMiddleware);
  io.of('/campaigns').use(async (socket, next) => {
    try {
      const request = socket.request as IncomingMessage & { session?: { passport?: { user?: number } } };
      const id = request.session?.passport?.user;
      const user = id ? await storage.getUser(id) : undefined;
      if (!user || !user.organizationId || user.isActive === false) return next(new Error('Authentication required'));
      socket.data.organizationId = user.organizationId;
      next();
    } catch { next(new Error('Authentication required')); }
  }).on('connection', socket => {
    void socket.join(`org:${socket.data.organizationId}`);
    socket.on('join-org', (orgId: number) => {
      if (orgId === socket.data.organizationId) void socket.join(`org:${orgId}`);
    });
  });
  return io;
}
export function broadcastCampaignEvent(orgId: number, event: unknown) {
  io?.of('/campaigns').to(`org:${orgId}`).emit('event', event);
}
export function getIO() { return io; }
