// src/routes/sse.routes.js
const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sse.controller');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_aqui';

// Middleware de autenticación para SSE (soporta token en query)
const authSSE = (req, res, next) => {
    try {
        // ✅ Obtener token de query param (EventSource no puede enviar headers)
        const token = req.query.token;

        if (!token) {
            console.error('❌ SSE Auth: No se proporcionó token');
            return res.status(401).json({ error: 'No se proporcionó token' });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        
        req.usuario = {
            idUsuario: decoded.idUsuario || decoded.id,
            id: decoded.idUsuario || decoded.id,
            email: decoded.email,
            nombre: decoded.nombre
        };

        console.log('✅ SSE Auth: Usuario autenticado:', req.usuario.email);
        next();
    } catch (error) {
        console.error('❌ SSE Auth error:', error.message);
        return res.status(401).json({ error: 'Token inválido: ' + error.message });
    }
};

// Ruta SSE para notificaciones en tiempo real
router.get('/notificaciones', authSSE, sseController.streamNotificaciones);

module.exports = router;