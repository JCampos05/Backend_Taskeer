// src/models/auditoriaCompartidos.js
const db = require('../config/config');

class AuditoriaCompartidos {
    /**
     * Registrar acción en auditoría
     */
    static async registrar({ tipo, idEntidad, idUsuario, accion, detalles = {} }) {
        try {
            const [result] = await db.execute(
                `INSERT INTO auditoria_compartidos 
                (tipo, idEntidad, idUsuario, accion, detalles) 
                VALUES (?, ?, ?, ?, ?)`,
                [tipo, idEntidad, idUsuario, accion, JSON.stringify(detalles)]
            );
            return result.insertId;
        } catch (error) {
            // No fallar si la auditoría falla
            console.error('Error al registrar auditoría:', error);
            return null;
        }
    }

    /**
     * Obtener historial de una entidad
     */
    static async obtenerHistorial(tipo, idEntidad) {
        try {
            const [rows] = await db.execute(
                `SELECT a.*, u.nombre as nombreUsuario, u.email
                 FROM auditoria_compartidos a
                 JOIN usuario u ON a.idUsuario = u.idUsuario
                 WHERE a.tipo = ? AND a.idEntidad = ?
                 ORDER BY a.fecha DESC
                 LIMIT 100`,
                [tipo, idEntidad]
            );
            return rows;
        } catch (error) {
            console.error('Error al obtener historial:', error);
            return [];
        }
    }
}

module.exports = AuditoriaCompartidos;