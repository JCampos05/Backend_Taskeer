const db = require('../config/config');

class CategoriaCompartida {
    constructor(data) {
        this.idCategoriaCompartida = data.idCategoriaCompartida;
        this.idCategoria = data.idCategoria;
        this.idUsuario = data.idUsuario;
        this.rol = data.rol;
        this.esCreador = Boolean(data.esCreador);
        this.fechaCompartido = data.fechaCompartido;
        this.compartidoPor = data.compartidoPor;
        this.aceptado = Boolean(data.aceptado);
        this.activo = Boolean(data.activo);
    }

    // Crear nuevo compartido
    static async crear(data) {
        try {
            const query = `
                INSERT INTO categoria_compartida 
                (idCategoria, idUsuario, rol, esCreador, compartidoPor, aceptado, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(query, [
                data.idCategoria,
                data.idUsuario,
                data.rol || 'colaborador',
                Boolean(data.esCreador) ? 1 : 0,
                data.compartidoPor,
                Boolean(data.aceptado) ? 1 : 0,
                Boolean(data.activo !== false) ? 1 : 0
            ]);

            return result.insertId;
        } catch (error) {
            throw new Error(`Error al crear compartido: ${error.message}`);
        }
    }

    // Obtener compartido específico
    static async obtener(idCategoria, idUsuario) {
        try {
            const query = `
                SELECT cc.*, u.nombre, u.email
                FROM categoria_compartida cc
                JOIN usuario u ON cc.idUsuario = u.idUsuario
                WHERE cc.idCategoria = ? AND cc.idUsuario = ?
            `;
            const [rows] = await db.execute(query, [idCategoria, idUsuario]);
            return rows.length > 0 ? new CategoriaCompartida(rows[0]) : null;
        } catch (error) {
            throw new Error(`Error al obtener compartido: ${error.message}`);
        }
    }

    // Listar usuarios con acceso a la categoría
    static async listarPorCategoria(idCategoria) {
        try {
            const query = `
                SELECT 
                    cc.*,
                    u.idUsuario,
                    u.nombre,
                    u.email
                FROM categoria_compartida cc
                JOIN usuario u ON cc.idUsuario = u.idUsuario
                WHERE cc.idCategoria = ? AND cc.activo = TRUE
                ORDER BY cc.esCreador DESC, cc.fechaCompartido ASC
            `;
            const [rows] = await db.execute(query, [idCategoria]);
            return rows;
        } catch (error) {
            throw new Error(`Error al listar usuarios: ${error.message}`);
        }
    }

    // Actualizar rol
    static async actualizarRol(idCategoria, idUsuario, nuevoRol) {
        try {
            const query = `
                UPDATE categoria_compartida 
                SET rol = ? 
                WHERE idCategoria = ? AND idUsuario = ? AND esCreador = FALSE
            `;
            const [result] = await db.execute(query, [nuevoRol, idCategoria, idUsuario]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al actualizar rol: ${error.message}`);
        }
    }

    // Revocar acceso
    static async revocar(idCategoria, idUsuario) {
        try {
            const query = `
                UPDATE categoria_compartida 
                SET activo = FALSE 
                WHERE idCategoria = ? AND idUsuario = ? AND esCreador = FALSE
            `;
            const [result] = await db.execute(query, [idCategoria, idUsuario]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al revocar acceso: ${error.message}`);
        }
    }

    // Reactivar acceso
    static async reactivar(idCategoria, idUsuario) {
        try {
            const query = `
                UPDATE categoria_compartida 
                SET activo = TRUE, aceptado = TRUE, fechaCompartido = CURRENT_TIMESTAMP
                WHERE idCategoria = ? AND idUsuario = ?
            `;
            const [result] = await db.execute(query, [idCategoria, idUsuario]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al reactivar acceso: ${error.message}`);
        }
    }
}

// src/models/listaCompartida.js
class ListaCompartida {
    constructor(data) {
        this.idListaCompartida = data.idListaCompartida;
        this.idLista = data.idLista;
        this.idUsuario = data.idUsuario;
        this.rol = data.rol;
        this.esCreador = data.esCreador;
        this.fechaCompartido = data.fechaCompartido;
        this.compartidoPor = data.compartidoPor;
        this.aceptado = data.aceptado;
        this.activo = data.activo;
    }

    static async crear(data) {
        try {
            const query = `
                INSERT INTO lista_compartida 
                (idLista, idUsuario, rol, esCreador, compartidoPor, aceptado, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(query, [
                data.idLista,
                data.idUsuario,
                data.rol || 'colaborador',
                data.esCreador || false,
                data.compartidoPor,
                data.aceptado !== undefined ? data.aceptado : false,
                data.activo !== undefined ? data.activo : true
            ]);

            return result.insertId;
        } catch (error) {
            throw new Error(`Error al crear compartido: ${error.message}`);
        }
    }

    static async obtener(idLista, idUsuario) {
        try {
            const query = `
                SELECT lc.*, u.nombre, u.email
                FROM lista_compartida lc
                JOIN usuario u ON lc.idUsuario = u.idUsuario
                WHERE lc.idLista = ? AND lc.idUsuario = ?
            `;
            const [rows] = await db.execute(query, [idLista, idUsuario]);
            return rows.length > 0 ? new ListaCompartida(rows[0]) : null;
        } catch (error) {
            throw new Error(`Error al obtener compartido: ${error.message}`);
        }
    }

    static async listarPorLista(idLista) {
        try {
            const query = `
                SELECT 
                    lc.*,
                    u.idUsuario,
                    u.nombre,
                    u.email
                FROM lista_compartida lc
                JOIN usuario u ON lc.idUsuario = u.idUsuario
                WHERE lc.idLista = ? AND lc.activo = TRUE
                ORDER BY lc.esCreador DESC, lc.fechaCompartido ASC
            `;
            const [rows] = await db.execute(query, [idLista]);
            return rows;
        } catch (error) {
            throw new Error(`Error al listar usuarios: ${error.message}`);
        }
    }

    static async actualizarRol(idLista, idUsuario, nuevoRol) {
        try {
            const query = `
                UPDATE lista_compartida 
                SET rol = ? 
                WHERE idLista = ? AND idUsuario = ? AND esCreador = FALSE
            `;
            const [result] = await db.execute(query, [nuevoRol, idLista, idUsuario]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al actualizar rol: ${error.message}`);
        }
    }

    static async revocar(idLista, idUsuario) {
        try {
            const query = `
                UPDATE lista_compartida 
                SET activo = FALSE 
                WHERE idLista = ? AND idUsuario = ? AND esCreador = FALSE
            `;
            const [result] = await db.execute(query, [idLista, idUsuario]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al revocar acceso: ${error.message}`);
        }
    }
}

// src/models/invitacion.js
class Invitacion {
    constructor(data) {
        this.idInvitacion = data.idInvitacion;
        this.tipo = data.tipo;
        this.idEntidad = data.idEntidad;
        this.emailInvitado = data.emailInvitado;
        this.rol = data.rol;
        this.token = data.token;
        this.invitadoPor = data.invitadoPor;
        this.fechaInvitacion = data.fechaInvitacion;
        this.fechaExpiracion = data.fechaExpiracion;
        this.aceptada = data.aceptada;
        this.activa = data.activa;
    }

    static async crear(data) {
        try {
            const query = `
                INSERT INTO invitacion 
                (tipo, idEntidad, emailInvitado, rol, token, invitadoPor, fechaExpiracion, activa)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
            `;
            const [result] = await db.execute(query, [
                data.tipo,
                data.idEntidad,
                data.emailInvitado,
                data.rol,
                data.token,
                data.invitadoPor,
                data.fechaExpiracion
            ]);

            return result.insertId;
        } catch (error) {
            throw new Error(`Error al crear invitación: ${error.message}`);
        }
    }

    static async obtenerPorToken(token) {
        try {
            const query = `
                SELECT i.*, u.nombre as nombreInvitador
                FROM invitacion i
                JOIN usuario u ON i.invitadoPor = u.idUsuario
                WHERE i.token = ? AND i.activa = TRUE
            `;
            const [rows] = await db.execute(query, [token]);
            return rows.length > 0 ? new Invitacion(rows[0]) : null;
        } catch (error) {
            throw new Error(`Error al obtener invitación: ${error.message}`);
        }
    }

    static async obtenerPendientesPorEmail(email) {
        try {
            const query = `
                SELECT i.*, 
                    u.nombre as nombreInvitador,
                    CASE 
                        WHEN i.tipo = 'categoria' THEN c.nombre
                        WHEN i.tipo = 'lista' THEN l.nombre
                    END as nombreEntidad
                FROM invitacion i
                JOIN usuario u ON i.invitadoPor = u.idUsuario
                LEFT JOIN categoria c ON i.tipo = 'categoria' AND i.idEntidad = c.idCategoria
                LEFT JOIN lista l ON i.tipo = 'lista' AND i.idEntidad = l.idLista
                WHERE i.emailInvitado = ? 
                    AND i.activa = TRUE 
                    AND i.aceptada = FALSE
                    AND (i.fechaExpiracion IS NULL OR i.fechaExpiracion > NOW())
                ORDER BY i.fechaInvitacion DESC
            `;
            const [rows] = await db.execute(query, [email]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener invitaciones: ${error.message}`);
        }
    }

    static async marcarComoAceptada(token) {
        try {
            const query = `
                UPDATE invitacion 
                SET aceptada = TRUE, activa = FALSE
                WHERE token = ?
            `;
            const [result] = await db.execute(query, [token]);
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al marcar invitación: ${error.message}`);
        }
    }
}

// src/models/auditoriaCompartidos.js
class AuditoriaCompartidos {
    static async registrar(data) {
        try {
            const query = `
                INSERT INTO auditoria_compartidos 
                (tipo, idEntidad, idUsuario, accion, detalles)
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(query, [
                data.tipo,
                data.idEntidad,
                data.idUsuario,
                data.accion,
                JSON.stringify(data.detalles || {})
            ]);

            return result.insertId;
        } catch (error) {
            console.error('Error en auditoría:', error);
            // No lanzar error para no bloquear operaciones
            return null;
        }
    }

    static async obtenerPorEntidad(tipo, idEntidad, limite = 50) {
        try {
            const query = `
                SELECT a.*, u.nombre as nombreUsuario
                FROM auditoria_compartidos a
                JOIN usuario u ON a.idUsuario = u.idUsuario
                WHERE a.tipo = ? AND a.idEntidad = ?
                ORDER BY a.fecha DESC
                LIMIT ?
            `;
            const [rows] = await db.execute(query, [tipo, idEntidad, limite]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener auditoría: ${error.message}`);
        }
    }
}

module.exports = {
    CategoriaCompartida,
    ListaCompartida,
    Invitacion,
    AuditoriaCompartidos
};