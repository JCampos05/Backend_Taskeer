// src/models/mensaje.js
const pool = require('../config/config');

class Mensaje {
    /**
     * Crear un nuevo mensaje
     */
    static async crear(datos) {
        const { contenido, idLista, idUsuario } = datos;

        const query = `
      INSERT INTO mensaje (contenido, idLista, idUsuario)
      VALUES (?, ?, ?)
    `;

        try {
            const [result] = await pool.execute(query, [contenido, idLista, idUsuario]);

            // Obtener el mensaje completo con información del usuario
            return await this.obtenerPorId(result.insertId);
        } catch (error) {
            throw new Error(`Error al crear mensaje: ${error.message}`);
        }
    }

    /**
     * Obtener mensaje por ID con información del usuario
     */
    static async obtenerPorId(idMensaje) {
        const query = `
      SELECT 
        m.idMensaje,
        m.contenido,
        m.idUsuario,
        m.idLista,
        m.editado,
        m.fechaCreacion,
        m.fechaEdicion,
        m.eliminado,
        u.nombre as nombreUsuario,
        u.email as emailUsuario,
        (SELECT COUNT(*) FROM mensaje_lectura ml WHERE ml.idMensaje = m.idMensaje) as totalLecturas
      FROM mensaje m
      INNER JOIN usuario u ON m.idUsuario = u.idUsuario
      WHERE m.idMensaje = ?
    `;

        try {
            const [rows] = await pool.execute(query, [idMensaje]);
            return rows[0] || null;
        } catch (error) {
            throw new Error(`Error al obtener mensaje: ${error.message}`);
        }
    }

    /**
     * Obtener mensajes de una lista con paginación
     */
    static async obtenerPorLista(idLista, idUsuario, limite = 50, offset = 0) {
        try {
            const [rows] = await pool.execute(
                'CALL sp_obtener_mensajes_lista(?, ?, ?, ?)',
                [idLista, idUsuario, limite, offset]
            );

            return rows[0] || [];
        } catch (error) {
            throw new Error(`Error al obtener mensajes: ${error.message}`);
        }
    }

    /**
     * Editar un mensaje
     */
    static async editar(idMensaje, idUsuario, nuevoContenido) {
        const query = `
      UPDATE mensaje 
      SET contenido = ?, editado = TRUE, fechaEdicion = NOW()
      WHERE idMensaje = ? AND idUsuario = ? AND eliminado = FALSE
    `;

        try {
            const [result] = await pool.execute(query, [nuevoContenido, idMensaje, idUsuario]);

            if (result.affectedRows === 0) {
                throw new Error('Mensaje no encontrado o sin permisos');
            }

            return await this.obtenerPorId(idMensaje);
        } catch (error) {
            throw new Error(`Error al editar mensaje: ${error.message}`);
        }
    }

    /**
     * Eliminar un mensaje (soft delete)
     */
    static async eliminar(idMensaje, idUsuario) {
        const query = `
      UPDATE mensaje 
      SET eliminado = TRUE, fechaEliminacion = NOW()
      WHERE idMensaje = ? AND idUsuario = ?
    `;

        try {
            const [result] = await pool.execute(query, [idMensaje, idUsuario]);

            if (result.affectedRows === 0) {
                throw new Error('Mensaje no encontrado o sin permisos');
            }

            return { success: true, idMensaje };
        } catch (error) {
            throw new Error(`Error al eliminar mensaje: ${error.message}`);
        }
    }

    /**
     * Marcar mensaje como leído
     */
    static async marcarComoLeido(idMensaje, idUsuario) {
        const query = `
      INSERT INTO mensaje_lectura (idMensaje, idUsuario, fechaLeido)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE fechaLeido = NOW()
    `;

        try {
            await pool.execute(query, [idMensaje, idUsuario]);
            return { success: true };
        } catch (error) {
            throw new Error(`Error al marcar como leído: ${error.message}`);
        }
    }

    /**
     * Marcar todos los mensajes de una lista como leídos
     */
    static async marcarTodosComoLeidos(idLista, idUsuario) {
        try {
            const [rows] = await pool.execute(
                'CALL sp_marcar_mensajes_leidos(?, ?)',
                [idLista, idUsuario]
            );

            return rows[0][0] || { mensajesMarcados: 0 };
        } catch (error) {
            throw new Error(`Error al marcar todos como leídos: ${error.message}`);
        }
    }

    /**
     * Obtener conteo de mensajes no leídos por lista
     */
    static async obtenerNoLeidos(idUsuario, idLista = null) {
        let query = `
      SELECT 
        l.idLista,
        l.nombre as nombreLista,
        COUNT(DISTINCT m.idMensaje) as mensajesNoLeidos
      FROM lista l
      INNER JOIN lista_compartida lc ON l.idLista = lc.idLista
      INNER JOIN mensaje m ON l.idLista = m.idLista
      LEFT JOIN mensaje_lectura ml ON m.idMensaje = ml.idMensaje 
        AND ml.idUsuario = ?
      WHERE lc.idUsuario = ?
        AND lc.activo = TRUE
        AND lc.aceptado = TRUE
        AND m.eliminado = FALSE
        AND m.idUsuario != ?
        AND ml.idMensajeLectura IS NULL
    `;

        const params = [idUsuario, idUsuario, idUsuario];

        if (idLista) {
            query += ' AND l.idLista = ?';
            params.push(idLista);
        }

        query += ' GROUP BY l.idLista';

        try {
            const [rows] = await pool.execute(query, params);
            return idLista && rows.length > 0 ? rows[0] : rows;
        } catch (error) {
            throw new Error(`Error al obtener no leídos: ${error.message}`);
        }
    }

    /**
     * Verificar si un usuario tiene acceso a una lista
     */
    static async verificarAccesoLista(idUsuario, idLista) {
        const query = `
      SELECT 1 
      FROM lista_compartida 
      WHERE idLista = ? 
        AND idUsuario = ? 
        AND activo = TRUE 
        AND aceptado = TRUE
      UNION
      SELECT 1
      FROM lista
      WHERE idLista = ?
        AND idUsuario = ?
      LIMIT 1
    `;

        try {
            const [rows] = await pool.execute(query, [idLista, idUsuario, idLista, idUsuario]);
            return rows.length > 0;
        } catch (error) {
            throw new Error(`Error al verificar acceso: ${error.message}`);
        }
    }
}

module.exports = Mensaje;