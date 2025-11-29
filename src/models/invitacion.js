// src/models/invitacion.js
const db = require('../config/config');

class Invitacion {
    /**
     * Crear invitación
     */
    static async crear({ tipo, idEntidad, emailInvitado, rol, token, invitadoPor, fechaExpiracion }) {
        try {
            const [result] = await db.execute(
                `INSERT INTO invitacion 
                (tipo, idEntidad, emailInvitado, rol, token, invitadoPor, fechaExpiracion) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [tipo, idEntidad, emailInvitado, rol, token, invitadoPor, fechaExpiracion]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error al crear invitación:', error);
            throw error;
        }
    }

    /**
     * Obtener invitación por token
     */
    static async obtenerPorToken(token) {
        try {
            const [rows] = await db.execute(
                `SELECT i.*, 
                        CASE 
                            WHEN i.tipo = 'categoria' THEN c.nombre
                            WHEN i.tipo = 'lista' THEN l.nombre
                        END as nombreEntidad,
                        u.nombre as nombreInvitador
                 FROM invitacion i
                 LEFT JOIN categoria c ON i.tipo = 'categoria' AND i.idEntidad = c.idCategoria
                 LEFT JOIN lista l ON i.tipo = 'lista' AND i.idEntidad = l.idLista
                 JOIN usuario u ON i.invitadoPor = u.idUsuario
                 WHERE i.token = ? AND i.activa = TRUE`,
                [token]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error al obtener invitación:', error);
            throw error;
        }
    }

    /**
     * Obtener invitaciones pendientes por email
     */
    static async obtenerPendientesPorEmail(email) {
        try {
            const [rows] = await db.execute(
                `SELECT i.*, 
                        CASE 
                            WHEN i.tipo = 'categoria' THEN c.nombre
                            WHEN i.tipo = 'lista' THEN l.nombre
                        END as nombreEntidad,
                        u.nombre as nombreInvitador
                 FROM invitacion i
                 LEFT JOIN categoria c ON i.tipo = 'categoria' AND i.idEntidad = c.idCategoria
                 LEFT JOIN lista l ON i.tipo = 'lista' AND i.idEntidad = l.idLista
                 JOIN usuario u ON i.invitadoPor = u.idUsuario
                 WHERE i.emailInvitado = ? 
                   AND i.activa = TRUE 
                   AND i.aceptada = FALSE
                   AND (i.fechaExpiracion IS NULL OR i.fechaExpiracion > NOW())
                 ORDER BY i.fechaInvitacion DESC`,
                [email]
            );
            return rows;
        } catch (error) {
            console.error('Error al obtener invitaciones pendientes:', error);
            throw error;
        }
    }

    /**
     * Marcar invitación como aceptada
     */
    static async marcarComoAceptada(token) {
        try {
            const [result] = await db.execute(
                `UPDATE invitacion SET aceptada = TRUE, activa = FALSE WHERE token = ?`,
                [token]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error al marcar invitación como aceptada:', error);
            throw error;
        }
    }
}

module.exports = Invitacion;