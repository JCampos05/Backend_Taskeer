// src/controllers/chat.controller.js
const Mensaje = require('../models/mensaje');
const ChatService = require('../socket/services/chat.service');

/**
 * Obtener historial de mensajes de una lista
 */
exports.obtenerHistorial = async (req, res) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario; // Del middleware de autenticación
        const { limite = 50, offset = 0 } = req.query;

        // Convertir a números
        const limiteNum = parseInt(limite);
        const offsetNum = parseInt(offset);

        // Validar límite
        if (limiteNum > 100) {
            return res.status(400).json({
                error: 'El límite máximo es 100 mensajes'
            });
        }

        // Verificar acceso
        const tieneAcceso = await Mensaje.verificarAccesoLista(idUsuario, idLista);
        if (!tieneAcceso) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta lista'
            });
        }

        // Obtener mensajes
        const mensajes = await Mensaje.obtenerPorLista(
            idLista,
            idUsuario,
            limiteNum,
            offsetNum
        );

        res.json({
            success: true,
            data: mensajes,
            pagination: {
                limite: limiteNum,
                offset: offsetNum,
                total: mensajes.length
            }
        });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            error: 'Error al obtener historial de mensajes',
            details: error.message
        });
    }
};

/**
 * Obtener mensajes no leídos
 */
exports.obtenerNoLeidos = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const { idLista } = req.query;

        const noLeidos = await Mensaje.obtenerNoLeidos(
            idUsuario,
            idLista ? parseInt(idLista) : null
        );

        res.json({
            success: true,
            data: noLeidos
        });

    } catch (error) {
        console.error('Error al obtener no leídos:', error);
        res.status(500).json({
            error: 'Error al obtener mensajes no leídos',
            details: error.message
        });
    }
};

/**
 * Marcar mensajes como leídos
 */
exports.marcarComoLeidos = async (req, res) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario;

        // Verificar acceso
        const tieneAcceso = await Mensaje.verificarAccesoLista(idUsuario, idLista);
        if (!tieneAcceso) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta lista'
            });
        }

        const resultado = await Mensaje.marcarTodosComoLeidos(idLista, idUsuario);

        res.json({
            success: true,
            data: resultado
        });

    } catch (error) {
        console.error('Error al marcar como leídos:', error);
        res.status(500).json({
            error: 'Error al marcar mensajes como leídos',
            details: error.message
        });
    }
};

/**
 * Obtener estadísticas del chat
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario;

        // Verificar acceso
        const tieneAcceso = await Mensaje.verificarAccesoLista(idUsuario, idLista);
        if (!tieneAcceso) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta lista'
            });
        }

        const estadisticas = await ChatService.obtenerEstadisticas(idLista);

        res.json({
            success: true,
            data: estadisticas
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            error: 'Error al obtener estadísticas',
            details: error.message
        });
    }
};

/**
 * Editar mensaje (REST endpoint)
 */
exports.editarMensaje = async (req, res) => {
    try {
        const { idMensaje } = req.params;
        const { contenido } = req.body;
        const idUsuario = req.usuario.idUsuario;

        if (!contenido) {
            return res.status(400).json({
                error: 'El contenido es requerido'
            });
        }

        const mensajeActualizado = await Mensaje.editar(
            idMensaje,
            idUsuario,
            contenido
        );

        res.json({
            success: true,
            data: mensajeActualizado
        });

    } catch (error) {
        console.error('Error al editar mensaje:', error);
        res.status(500).json({
            error: 'Error al editar mensaje',
            details: error.message
        });
    }
};

/**
 * Eliminar mensaje (REST endpoint)
 */
exports.eliminarMensaje = async (req, res) => {
    try {
        const { idMensaje } = req.params;
        const idUsuario = req.usuario.idUsuario;

        await Mensaje.eliminar(idMensaje, idUsuario);

        res.json({
            success: true,
            message: 'Mensaje eliminado correctamente'
        });

    } catch (error) {
        console.error('Error al eliminar mensaje:', error);
        res.status(500).json({
            error: 'Error al eliminar mensaje',
            details: error.message
        });
    }
};

/**
 * Obtener usuarios online en una lista
 */
exports.obtenerUsuariosOnline = async (req, res) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario;

        // Verificar acceso
        const tieneAcceso = await Mensaje.verificarAccesoLista(idUsuario, idLista);
        if (!tieneAcceso) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta lista'
            });
        }

        const usuariosOnline = await ChatService.obtenerUsuariosOnline(idLista);

        res.json({
            success: true,
            data: usuariosOnline
        });

    } catch (error) {
        console.error('Error al obtener usuarios online:', error);
        res.status(500).json({
            error: 'Error al obtener usuarios online',
            details: error.message
        });
    }
};