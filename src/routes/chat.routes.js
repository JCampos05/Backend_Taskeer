// src/routes/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { verificarToken } = require('../middlewares/authMiddleware'); // Tu middleware de auth existente

// Todas las rutas requieren autenticación
router.use(verificarToken);

/**
 * @route   GET /api/chat/lista/:idLista/mensajes
 * @desc    Obtener historial de mensajes de una lista
 * @access  Private
 */
router.get('/lista/:idLista/mensajes', chatController.obtenerHistorial);

/**
 * @route   GET /api/chat/mensajes/no-leidos
 * @desc    Obtener mensajes no leídos del usuario
 * @access  Private
 */
router.get('/mensajes/no-leidos', chatController.obtenerNoLeidos);

/**
 * @route   POST /api/chat/lista/:idLista/marcar-leidos
 * @desc    Marcar todos los mensajes de una lista como leídos
 * @access  Private
 */
router.post('/lista/:idLista/marcar-leidos', chatController.marcarComoLeidos);

/**
 * @route   GET /api/chat/lista/:idLista/estadisticas
 * @desc    Obtener estadísticas del chat de una lista
 * @access  Private
 */
router.get('/lista/:idLista/estadisticas', chatController.obtenerEstadisticas);

/**
 * @route   PUT /api/chat/mensaje/:idMensaje
 * @desc    Editar un mensaje
 * @access  Private
 */
router.put('/mensaje/:idMensaje', chatController.editarMensaje);

/**
 * @route   DELETE /api/chat/mensaje/:idMensaje
 * @desc    Eliminar un mensaje
 * @access  Private
 */
router.delete('/mensaje/:idMensaje', chatController.eliminarMensaje);

/**
 * @route   GET /api/chat/lista/:idLista/usuarios-online
 * @desc    Obtener usuarios conectados en una lista
 * @access  Private
 */
router.get('/lista/:idLista/usuarios-online', chatController.obtenerUsuariosOnline);

module.exports = router;