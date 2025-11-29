// src/socket/services/chat.service.js
const pool = require('../../config/config');
const Mensaje = require('../../models/mensaje');

class ChatService {
    /**
     * Registrar usuario online y su actividad
     */
    static async registrarUsuarioOnline(idUsuario, idLista, socketId) {
        const query = `
      INSERT INTO usuario_actividad (
        idUsuario, 
        idLista, 
        socketId, 
        conectado, 
        ultimaActividad,
        escribiendo,
        escribiendoDesde
      )
      VALUES (?, ?, ?, TRUE, NOW(), FALSE, NULL)
      ON DUPLICATE KEY UPDATE 
        conectado = TRUE,
        ultimaActividad = NOW(),
        escribiendo = FALSE,
        escribiendoDesde = NULL
    `;

        try {
            await pool.execute(query, [idUsuario, idLista, socketId]);
        } catch (error) {
            console.error('Error al registrar usuario online:', error);
        }
    }

    /**
     * Actualizar última actividad del usuario
     */
    static async actualizarActividad(socketId) {
        const query = `
      UPDATE usuario_actividad 
      SET ultimaActividad = NOW()
      WHERE socketId = ? AND conectado = TRUE
    `;

        try {
            await pool.execute(query, [socketId]);
        } catch (error) {
            console.error('Error al actualizar actividad:', error);
        }
    }

    /**
     * Remover usuario online (desconectar)
     */
    static async removerUsuarioOnline(socketId) {
        const query = `
      UPDATE usuario_actividad 
      SET conectado = FALSE, 
          escribiendo = FALSE,
          escribiendoDesde = NULL
      WHERE socketId = ?
    `;

        try {
            await pool.execute(query, [socketId]);
        } catch (error) {
            console.error('Error al remover usuario online:', error);
        }
    }

    /**
     * Remover usuario de una lista específica
     */
    static async removerUsuarioLista(idUsuario, idLista, socketId) {
        const query = `
      UPDATE usuario_actividad 
      SET conectado = FALSE,
          escribiendo = FALSE,
          escribiendoDesde = NULL
      WHERE idUsuario = ? AND idLista = ? AND socketId = ?
    `;

        try {
            await pool.execute(query, [idUsuario, idLista, socketId]);
        } catch (error) {
            console.error('Error al remover usuario de lista:', error);
        }
    }

    /**
     * Obtener usuarios online en una lista
     */
    static async obtenerUsuariosOnline(idLista) {
        const query = `
      SELECT DISTINCT
        ua.idUsuario,
        u.nombre,
        u.email,
        MAX(ua.ultimaActividad) as ultimaActividad,
        COUNT(DISTINCT ua.socketId) as conexionesActivas
      FROM usuario_actividad ua
      INNER JOIN usuario u ON ua.idUsuario = u.idUsuario
      WHERE ua.idLista = ?
        AND ua.conectado = TRUE
        AND ua.ultimaActividad >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      GROUP BY ua.idUsuario, u.nombre, u.email
      ORDER BY u.nombre
    `;

        try {
            const [rows] = await pool.execute(query, [idLista]);
            return rows;
        } catch (error) {
            console.error('Error al obtener usuarios online:', error);
            return [];
        }
    }

    /**
     * Registrar estado "escribiendo"
     */
    static async registrarEscribiendo(idUsuario, idLista, socketId) {
        const query = `
      UPDATE usuario_actividad
      SET escribiendo = TRUE,
          escribiendoDesde = NOW(),
          ultimaActividad = NOW()
      WHERE idUsuario = ? 
        AND idLista = ? 
        AND socketId = ?
        AND conectado = TRUE
    `;

        try {
            await pool.execute(query, [idUsuario, idLista, socketId]);
        } catch (error) {
            console.error('Error al registrar escribiendo:', error);
        }
    }

    /**
     * Remover estado "escribiendo"
     */
    static async removerEscribiendo(idUsuario, idLista, socketId = null) {
        let query, params;

        if (socketId) {
            // Remover para un socket específico
            query = `
        UPDATE usuario_actividad 
        SET escribiendo = FALSE,
            escribiendoDesde = NULL,
            ultimaActividad = NOW()
        WHERE idUsuario = ? AND idLista = ? AND socketId = ?
      `;
            params = [idUsuario, idLista, socketId];
        } else {
            // Remover para todos los sockets del usuario en esa lista
            query = `
        UPDATE usuario_actividad 
        SET escribiendo = FALSE,
            escribiendoDesde = NULL,
            ultimaActividad = NOW()
        WHERE idUsuario = ? AND idLista = ?
      `;
            params = [idUsuario, idLista];
        }

        try {
            await pool.execute(query, params);
        } catch (error) {
            console.error('Error al remover escribiendo:', error);
        }
    }

    /**
     * Obtener usuarios escribiendo en una lista
     */
    static async obtenerUsuariosEscribiendo(idLista) {
        const query = `
      SELECT DISTINCT
        ua.idUsuario,
        u.nombre,
        u.email,
        ua.escribiendoDesde
      FROM usuario_actividad ua
      INNER JOIN usuario u ON ua.idUsuario = u.idUsuario
      WHERE ua.idLista = ?
        AND ua.escribiendo = TRUE
        AND ua.conectado = TRUE
        AND ua.escribiendoDesde >= DATE_SUB(NOW(), INTERVAL 30 SECOND)
      GROUP BY ua.idUsuario, u.nombre, u.email, ua.escribiendoDesde
    `;

        try {
            const [rows] = await pool.execute(query, [idLista]);
            return rows;
        } catch (error) {
            console.error('Error al obtener usuarios escribiendo:', error);
            return [];
        }
    }

    /**
     * Verificar si un usuario está online en una lista
     */
    static async estaUsuarioOnline(idUsuario, idLista) {
        const query = `
      SELECT 1
      FROM usuario_actividad
      WHERE idUsuario = ?
        AND idLista = ?
        AND conectado = TRUE
        AND ultimaActividad >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      LIMIT 1
    `;

        try {
            const [rows] = await pool.execute(query, [idUsuario, idLista]);
            return rows.length > 0;
        } catch (error) {
            console.error('Error al verificar usuario online:', error);
            return false;
        }
    }

    /**
     * Obtener todas las listas donde el usuario está conectado
     */
    static async obtenerListasActivasUsuario(idUsuario) {
        const query = `
      SELECT DISTINCT
        ua.idLista,
        l.nombre as nombreLista
      FROM usuario_actividad ua
      INNER JOIN lista l ON ua.idLista = l.idLista
      WHERE ua.idUsuario = ?
        AND ua.conectado = TRUE
        AND ua.ultimaActividad >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `;

        try {
            const [rows] = await pool.execute(query, [idUsuario]);
            return rows;
        } catch (error) {
            console.error('Error al obtener listas activas:', error);
            return [];
        }
    }

    /**
     * Validar mensaje
     */
    static validarMensaje(contenido) {
        if (!contenido || typeof contenido !== 'string') {
            throw new Error('El contenido del mensaje es requerido');
        }

        const contenidoLimpio = contenido.trim();

        if (contenidoLimpio.length === 0) {
            throw new Error('El mensaje no puede estar vacío');
        }

        if (contenidoLimpio.length > 5000) {
            throw new Error('El mensaje no puede exceder 5000 caracteres');
        }

        return contenidoLimpio;
    }

    /**
     * Crear mensaje
     */
    static async crearMensaje(idLista, idUsuario, contenido) {
        try {
            // Validar contenido
            const contenidoLimpio = this.validarMensaje(contenido);

            // Verificar acceso
            const tieneAcceso = await Mensaje.verificarAccesoLista(idUsuario, idLista);
            if (!tieneAcceso) {
                throw new Error('No tienes permisos para enviar mensajes en esta lista');
            }

            // Crear mensaje
            const mensaje = await Mensaje.crear({
                contenido: contenidoLimpio,
                idLista,
                idUsuario
            });

            return mensaje;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtener estadísticas del chat
     */
    static async obtenerEstadisticas(idLista) {
        const query = `
      SELECT 
        COUNT(DISTINCT m.idMensaje) as totalMensajes,
        COUNT(DISTINCT m.idUsuario) as usuariosActivos,
        COUNT(DISTINCT CASE WHEN m.fechaCreacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR) 
          THEN m.idMensaje END) as mensajesUltimas24h,
        COUNT(DISTINCT CASE WHEN m.fechaCreacion >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
          THEN m.idMensaje END) as mensajesUltimaSemana,
        MIN(m.fechaCreacion) as primerMensaje,
        MAX(m.fechaCreacion) as ultimoMensaje
      FROM mensaje m
      WHERE m.idLista = ?
        AND m.eliminado = FALSE
    `;

        try {
            const [rows] = await pool.execute(query, [idLista]);

            // Obtener usuarios online
            const usuariosOnline = await this.obtenerUsuariosOnline(idLista);

            // Obtener usuarios escribiendo
            const usuariosEscribiendo = await this.obtenerUsuariosEscribiendo(idLista);

            return {
                ...rows[0],
                usuariosOnline: usuariosOnline.length,
                usuariosEscribiendo: usuariosEscribiendo.length
            };
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            return null;
        }
    }

    /**
     * Limpiar actividad inactiva manualmente (además del evento programado)
     */
    static async limpiarActividadInactiva() {
        try {
            await pool.execute('CALL sp_limpiar_actividad_inactiva()');
            console.log('✅ Actividad inactiva limpiada');
        } catch (error) {
            console.error('Error al limpiar actividad inactiva:', error);
        }
    }
}

module.exports = ChatService;