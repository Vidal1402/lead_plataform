import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { leadGenerationService } from '../services/leadGenerationService';
import jwt from 'jsonwebtoken';

export class WebSocketManager {
  private io: SocketIOServer | null = null;

  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupAuthentication();
    this.setupEventHandlers();
  }

  private setupAuthentication(): void {
    this.io!.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth['token'] || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Token não fornecido'));
        }

        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env['JWT_SECRET']!);
        socket.data.user = decoded;
        next();
      } catch (error) {
        next(new Error('Token inválido'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io!.on('connection', (socket) => {
      console.log(`Cliente conectado: ${socket.id}`);

      // Entrar na sala de leads do usuário
      const userId = socket.data.user.userId;
      socket.join(`leads_${userId}`);

      // Evento para acompanhar progresso de geração
      socket.on('join-generation', (sessionId: string) => {
        socket.join(`generation_${sessionId}`);
        console.log(`Cliente ${socket.id} entrou na sessão ${sessionId}`);
      });

      // Evento para sair da sessão
      socket.on('leave-generation', (sessionId: string) => {
        socket.leave(`generation_${sessionId}`);
        console.log(`Cliente ${socket.id} saiu da sessão ${sessionId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
      });
    });

    // Configurar listeners do serviço de geração
    this.setupGenerationListeners();
  }

  private setupGenerationListeners(): void {
    // Listener para progresso
    leadGenerationService.on('progress', (progress) => {
      this.io!.to(`generation_${progress.sessionId}`).emit('generation-progress', progress);
    });

    // Listener para batch de leads
    leadGenerationService.on('batch', (batchData) => {
      this.io!.to(`generation_${batchData.sessionId}`).emit('leads-batch', {
        sessionId: batchData.sessionId,
        leads: batchData.leads,
        batchNumber: batchData.batchNumber,
        csvUrl: `/api/leads/download-batch/${batchData.sessionId}/${batchData.batchNumber}`
      });
    });

    // Listener para conclusão
    leadGenerationService.on('completed', (completionData) => {
      this.io!.to(`generation_${completionData.sessionId}`).emit('generation-completed', {
        sessionId: completionData.sessionId,
        totalLeads: completionData.totalLeads,
        message: 'Geração de leads concluída com sucesso!'
      });
    });

    // Listener para erro
    leadGenerationService.on('error', (error) => {
      this.io!.emit('generation-error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Método para enviar mensagem para um usuário específico
  sendToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`leads_${userId}`).emit(event, data);
    }
  }

  // Método para enviar mensagem para uma sessão específica
  sendToSession(sessionId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`generation_${sessionId}`).emit(event, data);
    }
  }

  // Método para broadcast global
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Obter estatísticas de conexões
  getConnectionStats(): { totalConnections: number; activeRooms: number } {
    if (!this.io) {
      return { totalConnections: 0, activeRooms: 0 };
    }

    const rooms = this.io.sockets.adapter.rooms;
    let activeRooms = 0;

    for (const [roomId] of rooms) {
      if (roomId.startsWith('generation_') || roomId.startsWith('leads_')) {
        activeRooms++;
      }
    }

    return {
      totalConnections: this.io.engine.clientsCount,
      activeRooms: activeRooms
    };
  }
}

export const webSocketManager = new WebSocketManager(); 