import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true
  }
})
export class AuditGateway {
  @WebSocketServer()
  server!: Server;

  publish(auditId: string, status: string, message: string) {
    this.server.emit(`audit:${auditId}`, { auditId, status, message, at: new Date().toISOString() });
  }
}
