require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const pool = require('./config/config');
const { initializeSocket } = require('./socket/socket.config');

const tareaRoutes = require('./routes/tareas.routes');
const listaRoutes = require('./routes/lista.routes');
const categoriaRoutes = require('./routes/categoria.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const compartirRoutes = require('./routes/compartir.routes');
const notaRoutes = require('./routes/notas.routes');
const notificacionRoutes = require('./routes/compartir/notificacion.routes');
const chatRoutes = require('./routes/chat.routes');
const verificarToken = require('./middlewares/authMiddleware').verificarToken;
const sseRoutes = require('./routes/see.routes');
const estadisticasRoutes = require('./routes/estadisticas.routes');
const notificacionesService = require('./services/notificaciones.service');
const zonasRoutes = require('./routes/zonas.routes');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// CORS configurado para producción y desarrollo
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            /^http:\/\/localhost:\d+$/,
            /^http:\/\/127\.0\.0\.1:\d+$/,
            process.env.FRONTEND_URL, // Tu dominio de Vercel
            /^https:\/\/.*\.vercel\.app$/, // Cualquier preview de Vercel
        ].filter(Boolean); // Elimina undefined si FRONTEND_URL no está configurado

        if (!origin) {
            return callback(null, true);
        }

        const isAllowed = allowedOrigins.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(origin);
            }
            return pattern === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS bloqueado para origen: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Cache-Control'],
    maxAge: 86400
}));

// Middleware específico para SSE
app.use('/api/sse', (req, res, next) => {
    const origin = req.headers.origin;
    
    const allowedOrigins = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        process.env.FRONTEND_URL,
        /^https:\/\/.*\.vercel\.app$/,
    ].filter(Boolean);

    if (origin) {
        const isAllowed = allowedOrigins.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(origin);
            }
            return pattern === origin;
        });

        if (isAllowed) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Solo servir archivos estáticos en desarrollo
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(express.static('../Frontend2'));
}

// Middleware para logging (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path} - ${new Date().toLocaleString()}`);
        next();
    });
}

// Health check
app.get('/healthz', async (req, res) => {
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const checkPromise = (async () => {
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();
        })();
        
        await Promise.race([checkPromise, timeoutPromise]);
        res.status(200).json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy',
            error: error.message 
        });
    }
});

// SSE debe ir ANTES de otras rutas
app.use('/api/sse', sseRoutes);

// Rutas de API
app.use('/api/tareas', verificarToken, tareaRoutes);
app.use('/api/listas', verificarToken, listaRoutes);
app.use('/api/categorias', verificarToken, categoriaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/compartir', verificarToken, compartirRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/compartir/notificaciones', notificacionRoutes);
app.use('/api/chat', verificarToken, chatRoutes);
app.use('/api/estadisticas', verificarToken, estadisticasRoutes);
app.use('/api/zonas', zonasRoutes);

// Ruta raíz - Solo en desarrollo sirve el frontend
app.get('/', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        res.json({
            success: true,
            message: 'Taskeer API',
            version: '1.0.0',
            endpoints: {
                health: '/healthz',
                api: '/api'
            }
        });
    } else {
        res.sendFile(path.join(__dirname, '../Frontend2', 'login.html'));
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`🚀 Servidor corriendo en modo: ${env}`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log(`📋 API de Tareas: /api/tareas`);
    console.log(`🔔 API de Notificaciones: /api/compartir/notificaciones`);
    console.log(`💬 WebSocket Chat: /chat`);
    console.log(`📡 SSE Endpoint: /api/sse/notificaciones`);
    
    console.log('\n🔔 Iniciando servicio de notificaciones automáticas...');
    notificacionesService.iniciar();
    console.log('✅ Servicio de notificaciones activo\n');
});

const sseManager = require('./utils/sseManager');

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\nERROR: El puerto ${PORT} ya está en uso`);
        console.error('   Intenta cerrar otras aplicaciones o usar otro puerto\n');
        process.exit(1);
    } else {
        console.error('\nError del servidor:', error.message, '\n');
        process.exit(1);
    }
});

const gracefulShutdown = () => {
    console.log('\nCerrando servidor...');

    notificacionesService.detener();
    sseManager.cleanup();
    
    server.close(() => {
        console.log('Servidor HTTP cerrado');
        pool.end(() => {
            console.log('Pool MySQL cerrado');
            process.exit(0);
        });
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;