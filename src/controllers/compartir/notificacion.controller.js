// src/controllers/compartir/notificacion.controller.js
const db = require('../../config/config');
const sseManager = require('../../utils/sseManager');
/**
 * Crear una notificación y enviarla por SSE
 */
exports.crearNotificacion = async (connection, idUsuario, tipo, titulo, mensaje, datos = {}) => {
    try {
        // ✅ Validar parámetros
        if (!idUsuario || !tipo || !titulo || !mensaje) {
            throw new Error('Parámetros incompletos para crear notificación');
        }

        console.log('📝 Creando notificación:', {
            idUsuario: parseInt(idUsuario),
            tipo,
            titulo: titulo.substring(0, 50)
        });

        // ✅ Insertar en base de datos
        const [result] = await connection.execute(
            `INSERT INTO notificaciones 
            (id_usuario, tipo, titulo, mensaje, datos_adicionales, leida, fecha_creacion) 
            VALUES (?, ?, ?, ?, ?, 0, NOW())`,
            [parseInt(idUsuario), tipo, titulo, mensaje, JSON.stringify(datos || {})]
        );

        const idNotificacion = result.insertId;

        if (!idNotificacion) {
            throw new Error('No se pudo obtener ID de notificación insertada');
        }

        console.log('✅ Notificación creada en BD con ID:', idNotificacion);

        // ✅ Preparar objeto SSE COMPLETO
        const notificacionSSE = {
            event: 'nueva_notificacion',
            id: parseInt(idNotificacion),
            idNotificacion: parseInt(idNotificacion), // ✅ CRÍTICO: Campo duplicado para compatibilidad
            idUsuario: parseInt(idUsuario),
            tipo: tipo,
            titulo: titulo,
            mensaje: mensaje,
            datos: datos || {},
            leida: false,
            fechaCreacion: new Date().toISOString()
        };

        console.log('📦 Objeto SSE preparado:', {
            id: notificacionSSE.id,
            idNotificacion: notificacionSSE.idNotificacion,
            tipo: notificacionSSE.tipo,
            titulo: notificacionSSE.titulo.substring(0, 30)
        });

        // ✅ Enviar notificación en tiempo real vía SSE
        try {
            const enviado = sseManager.sendToUser(parseInt(idUsuario), notificacionSSE);

            if (enviado) {
                console.log(`📢 Notificación SSE enviada exitosamente a usuario ${idUsuario}`);
            } else {
                console.log(`⚠️ Usuario ${idUsuario} no conectado a SSE, notificación guardada en BD`);
            }
        } catch (sseError) {
            console.error('❌ Error al enviar SSE (notificación guardada en BD):', sseError.message);
            // No lanzamos error, la notificación ya está en BD
        }

        return idNotificacion;
    } catch (error) {
        console.error('❌ Error al crear notificación:', error);
        console.error('Stack:', error.stack);
        throw error;
    }
};

/**
 * Obtener notificaciones del usuario
 */
exports.obtenerNotificaciones = async (req, res) => {
    try {
        // ✅ FIX: Maneja ambos casos (id o idUsuario)
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        console.log('🔍 Usuario solicitando notificaciones:', idUsuario);
        console.log('🔍 Objeto completo req.usuario:', req.usuario);

        if (!idUsuario) {
            return res.status(401).json({ error: 'Usuario no autenticado correctamente' });
        }

        const [notificaciones] = await db.execute(
            `SELECT id as idNotificacion, 
                    id_usuario as idUsuario, 
                    tipo, 
                    titulo, 
                    mensaje, 
                    datos_adicionales as datos, 
                    leida, 
                    fecha_creacion as fechaCreacion
             FROM notificaciones 
             WHERE id_usuario = ? 
             ORDER BY fecha_creacion DESC 
             LIMIT 50`,
            [idUsuario]
        );

        console.log(`✅ Se encontraron ${notificaciones.length} notificaciones`);

        res.json({
            notificaciones: notificaciones.map(n => ({
                ...n,
                datos: typeof n.datos === 'string' ? JSON.parse(n.datos) : (n.datos || {})
            }))
        });
    } catch (error) {
        console.error('❌ Error al obtener notificaciones:', error);
        res.status(500).json({
            error: 'Error al obtener notificaciones',
            detalle: error.message // ✅ Devuelve el error específico
        });
    }
};

/**
 * Marcar notificación como leída
 */
exports.marcarComoLeida = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ FIX: Verificar que req.usuario existe
        if (!req.usuario) {
            console.error('❌ req.usuario es undefined');
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        // ✅ FIX: Verificar que idUsuario es válido
        if (!idUsuario || idUsuario === undefined) {
            console.error('❌ idUsuario es undefined. req.usuario:', req.usuario);
            return res.status(401).json({ error: 'ID de usuario no válido' });
        }

        // ✅ FIX: Verificar que id de notificación es válido
        if (!id || id === undefined || id === 'undefined') {
            console.error('❌ ID de notificación inválido:', id);
            return res.status(400).json({ error: 'ID de notificación inválido' });
        }

        console.log(`📝 Marcando notificación ${id} como leída para usuario ${idUsuario}`);

        const [result] = await db.execute(
            `UPDATE notificaciones 
             SET leida = 1 
             WHERE id = ? AND id_usuario = ?`,
            [parseInt(id), parseInt(idUsuario)]
        );

        if (result.affectedRows === 0) {
            console.warn(`⚠️ Notificación ${id} no encontrada o no pertenece al usuario ${idUsuario}`);
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        console.log(`✅ Notificación ${id} marcada como leída`);

        // Responder primero
        res.json({ mensaje: 'Notificación marcada como leída' });

        // Luego enviar SSE
        if (result.affectedRows > 0) {
            sseManager.sendToUser(parseInt(idUsuario), {
                event: 'notificacion_leida',
                id: parseInt(id),
                idNotificacion: parseInt(id),
                leida: true
            });
        }

    } catch (error) {
        console.error('❌ Error al marcar notificación:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            error: 'Error al actualizar notificación',
            detalle: error.message
        });
    }
};

/**
 * Marcar todas como leídas
 */
exports.marcarTodasLeidas = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!idUsuario) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        await db.execute(
            `UPDATE notificaciones 
             SET leida = 1 
             WHERE id_usuario = ? AND leida = 0`,
            [idUsuario]
        );

        res.json({ mensaje: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        console.error('Error al marcar notificaciones:', error);
        res.status(500).json({ error: 'Error al actualizar notificaciones' });
    }
};

/**
 * Aceptar invitación
 */
exports.aceptarInvitacion = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!idUsuario) {
            await connection.rollback();
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const [notificaciones] = await connection.execute(
            `SELECT * FROM notificaciones 
                WHERE id = ? AND id_usuario = ? AND tipo = 'invitacion_lista'`,
            [id, idUsuario]
        );

        if (notificaciones.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        const notificacion = notificaciones[0];
        const datos = typeof notificacion.datos_adicionales === 'string'
            ? JSON.parse(notificacion.datos_adicionales)
            : notificacion.datos_adicionales;

        // Verificar que la lista existe
        const [listas] = await connection.execute(
            `SELECT * FROM lista WHERE idLista = ?`,
            [datos.listaId]
        );
        if (listas.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Lista no encontrada' });
        }

        await connection.execute(
            `INSERT INTO lista_compartida 
            (idLista, idUsuario, rol, compartidoPor, aceptado, activo, fechaCompartido)
            VALUES (?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE aceptado = 1, activo = 1`,
            [datos.listaId, idUsuario, datos.rol, datos.invitadoPorId || null]
        );

        await connection.execute(
            `UPDATE notificaciones SET leida = 1 WHERE id = ?`,
            [id]
        );

        await connection.commit();

        res.json({
            mensaje: 'Invitación aceptada',
            lista: { idLista: datos.listaId, nombre: datos.listaNombre }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al aceptar invitación:', error);
        res.status(500).json({
            error: 'Error al aceptar invitación',
            detalle: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Rechazar invitación
 */
exports.rechazarInvitacion = async (req, res) => {
    try {
        const { id } = req.params;
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!idUsuario) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        await db.execute(
            `UPDATE notificaciones 
             SET leida = 1 
             WHERE id = ? AND id_usuario = ?`,
            [id, idUsuario]
        );

        res.json({ mensaje: 'Invitación rechazada' });
    } catch (error) {
        console.error('Error al rechazar invitación:', error);
        res.status(500).json({ error: 'Error al rechazar invitación' });
    }
};

/**
 * Crear notificación de repetición de tarea
 */
exports.crearNotificacionRepeticion = async (req, res) => {
    try {
        const { tareaId, tareaNombre, fechaVencimiento } = req.body;
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!idUsuario) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const titulo = 'Tarea repetida';
        const mensaje = `Tu tarea "${tareaNombre}" se ha programado nuevamente para ${new Date(fechaVencimiento).toLocaleDateString()}`;

        const datos = JSON.stringify({
            tareaId,
            tareaNombre,
            fechaVencimiento
        });

        await db.execute(
            `INSERT INTO notificaciones 
            (id_usuario, tipo, titulo, mensaje, datos_adicionales, leida, fecha_creacion) 
            VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
            [idUsuario, 'tarea_repetir', titulo, mensaje, datos]
        );

        res.json({ success: true, message: 'Notificación de repetición creada' });
    } catch (error) {
        console.error('Error al crear notificación de repetición:', error);
        res.status(500).json({ error: 'Error al crear notificación' });
    }
};

/**
 * Programar recordatorio
 */
exports.programarRecordatorio = async (req, res) => {
    try {
        const { tareaId, tareaNombre, fechaRecordatorio } = req.body;
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!idUsuario) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const titulo = 'Recordatorio de tarea';
        const mensaje = `Recordatorio: "${tareaNombre}"`;

        const datos = JSON.stringify({
            tareaId,
            tareaNombre,
            fechaVencimiento: fechaRecordatorio
        });

        await db.execute(
            `INSERT INTO notificaciones 
            (id_usuario, tipo, titulo, mensaje, datos_adicionales, leida, fecha_creacion) 
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [idUsuario, 'recordatorio', titulo, mensaje, datos, fechaRecordatorio]
        );

        res.json({ success: true, message: 'Recordatorio programado' });
    } catch (error) {
        console.error('Error al programar recordatorio:', error);
        res.status(500).json({ error: 'Error al programar recordatorio' });
    }
};

module.exports = exports;