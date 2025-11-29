const db = require('../config/config');

class ListaCompartida {
    /**
     * Crear acceso compartido a lista
     */
    static async crear({ idLista, idUsuario, rol, compartidoPor, aceptado = false, activo = true }) {
        try {
            const [result] = await db.execute(
                `INSERT INTO lista_compartida 
                (idLista, idUsuario, rol, compartidoPor, aceptado, activo, esCreador) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idLista, idUsuario, rol, compartidoPor, aceptado, activo, false]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error al crear lista compartida:', error);
            throw error;
        }
    }

    /**
     * Obtener acceso de un usuario a una lista
     */
    static async obtener(idLista, idUsuario) {
        try {
            const [rows] = await db.execute(
                `SELECT * FROM lista_compartida 
                 WHERE idLista = ? AND idUsuario = ?`,
                [idLista, idUsuario]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error al obtener lista compartida:', error);
            throw error;
        }
    }

    /**
     * Listar usuarios con acceso a una lista
     */
    static async listarPorLista(idLista) {
        try {
            const [rows] = await db.execute(
                `SELECT lc.*, u.nombre, u.email,
                        (l.idUsuario = lc.idUsuario) as esCreador
                 FROM lista_compartida lc
                 JOIN usuario u ON lc.idUsuario = u.idUsuario
                 JOIN lista l ON lc.idLista = l.idLista
                 WHERE lc.idLista = ? AND lc.activo = TRUE
                 ORDER BY lc.esCreador DESC, u.nombre ASC`,
                [idLista]
            );
            return rows;
        } catch (error) {
            console.error('Error al listar usuarios de lista:', error);
            throw error;
        }
    }

    /**
     * Actualizar rol de un usuario
     */
    static async actualizarRol(idLista, idUsuario, nuevoRol) {
        try {
            const [checkCreador] = await db.execute(
                `SELECT l.idUsuario FROM lista l WHERE l.idLista = ?`,
                [idLista]
            );

            if (checkCreador.length > 0 && checkCreador[0].idUsuario === idUsuario) {
                return false;
            }

            const [result] = await db.execute(
                `UPDATE lista_compartida 
                 SET rol = ? 
                 WHERE idLista = ? AND idUsuario = ? AND esCreador = FALSE`,
                [nuevoRol, idLista, idUsuario]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error al actualizar rol:', error);
            throw error;
        }
    }

    /**
     * Revocar acceso
     */
    static async revocar(idLista, idUsuario) {
        try {
            const [result] = await db.execute(
                `UPDATE lista_compartida 
                 SET activo = FALSE 
                 WHERE idLista = ? AND idUsuario = ? AND esCreador = FALSE`,
                [idLista, idUsuario]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error al revocar acceso:', error);
            throw error;
        }
    }
}

module.exports = ListaCompartida;