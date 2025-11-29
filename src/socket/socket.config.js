// src/socket/socket.config.js
const socketIo = require('socket.io');
const socketAuth = require('./middlewares/socket.auth');
const ChatHandler = require('./handlers/chat.handler');

let io;

/**
 * Inicializar Socket.IO
 */
const initializeSocket = (server) => {
  console.log('🚀 Inicializando Socket.IO...');

  io = socketIo(server, {
    cors: {
      origin: ['http://localhost:4200', 'http://localhost:4300'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Namespace principal para chat
  const chatNamespace = io.of('/chat');

  // Middleware de autenticación
  chatNamespace.use(socketAuth);

  // Manejar conexiones
  chatNamespace.on('connection', (socket) => {
    console.log(`\n🟢 Nueva conexión de socket`);
    console.log(`   Usuario: ${socket.userEmail} (ID: ${socket.userId})`);
    console.log(`   Socket ID: ${socket.id}\n`);

    // Inicializar manejador de eventos
    new ChatHandler(io, socket);

    // Evento de error genérico
    socket.on('error', (error) => {
      console.error('❌ Error en socket:', error);
    });
  });

  // Manejar errores de conexión
  chatNamespace.on('connect_error', (error) => {
    console.error('❌ Error de conexión:', error);
  });

  console.log('✅ Socket.IO inicializado correctamente\n');

  return io;
};

/**
 * Obtener instancia de IO
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return io;
};

/**
 * Emitir evento a una lista específica
 */
const emitToList = (idLista, event, data) => {
  if (!io) {
    console.warn('Socket.IO no inicializado, no se puede emitir evento');
    return;
  }

  const roomName = `lista:${idLista}`;
  io.of('/chat').to(roomName).emit(event, data);
};

/**
 * Emitir evento a un usuario específico
 */
const emitToUser = (idUsuario, event, data) => {
  if (!io) {
    console.warn('Socket.IO no inicializado, no se puede emitir evento');
    return;
  }

  // Buscar todos los sockets del usuario
  const sockets = Array.from(io.of('/chat').sockets.values());
  const userSockets = sockets.filter(socket => socket.userId === idUsuario);

  userSockets.forEach(socket => {
    socket.emit(event, data);
  });
};

module.exports = {
  initializeSocket,
  getIO,
  emitToList,
  emitToUser
};