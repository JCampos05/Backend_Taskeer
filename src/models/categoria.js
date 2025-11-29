// src/models/categoria.js (ACTUALIZADO)
const db = require('../config/config');

class Categoria {
    constructor(data) {
        this.idCategoria = data.idCategoria;
        this.nombre = data.nombre;
        this.compartible = Boolean(data.compartible);
        this.tipoPrivacidad = data.tipoPrivacidad || 'privada';
        this.claveCompartir = data.claveCompartir || null;
        this.fechaActualizacion = data.fechaActualizacion;
    }

    // Crear una nueva categoría
    static async crear(categoriaData) {
        try {
            const { nombre, idUsuario } = categoriaData;
            const query = `INSERT INTO categoria (nombre, idUsuario) VALUES (?, ?)`;

            const [result] = await db.execute(query, [nombre, idUsuario]);
            const idCategoria = result.insertId;

            // IMPORTANTE: Crear registro en categoria_compartida para el creador como admin
            const queryCompartido = `
                INSERT INTO categoria_compartida 
                (idCategoria, idUsuario, rol, esCreador, compartidoPor, aceptado, activo) 
                VALUES (?, ?, 'admin', TRUE, ?, TRUE, TRUE)
            `;
            await db.execute(queryCompartido, [idCategoria, idUsuario, idUsuario]);

            return {
                idCategoria,
                nombre: categoriaData.nombre,
                compartible: true,
                tipoPrivacidad: 'privada'
            };
        } catch (error) {
            throw new Error(`Error al crear categoría: ${error.message}`);
        }
    }

    // Obtener todas las categorías (incluyendo compartidas)
    static async obtenerTodas(idUsuario) {
        try {
            const query = `
                SELECT DISTINCT 
                    c.*,
                    cc.rol,
                    cc.esCreador,
                    cc.aceptado,
                    (c.idUsuario = ?) as esPropietario
                FROM categoria c
                LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                    AND cc.idUsuario = ? 
                    AND cc.activo = TRUE
                WHERE c.idUsuario = ? OR (cc.idUsuario = ? AND cc.activo = TRUE)
                ORDER BY c.nombre ASC
            `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, idUsuario, idUsuario]);
            return rows.map(row => new Categoria(row));
        } catch (error) {
            throw new Error(`Error al obtener categorías: ${error.message}`);
        }
    }

    // Obtener categoría por ID (verificando permisos)
    static async obtenerPorId(id, idUsuario) {
        try {
            const query = `
                SELECT 
                    c.*,
                    cc.rol,
                    cc.esCreador,
                    cc.aceptado,
                    (c.idUsuario = ?) as esPropietario
                FROM categoria c
                LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                    AND cc.idUsuario = ? 
                    AND cc.activo = TRUE
                WHERE c.idCategoria = ? 
                    AND (c.idUsuario = ? OR (cc.idUsuario = ? AND cc.activo = TRUE))
            `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, id, idUsuario, idUsuario]);

            if (rows.length === 0) {
                return null;
            }

            return new Categoria(rows[0]);
        } catch (error) {
            throw new Error(`Error al obtener categoría: ${error.message}`);
        }
    }

    // Actualizar categoría (verificando permisos)
    static async actualizar(id, categoriaData, idUsuario) {
        try {
            if (!categoriaData.nombre) {
                throw new Error('El nombre es requerido');
            }

            // Verificar permisos
            const tienePermiso = await this.verificarPermiso(id, idUsuario, 'editar');
            if (!tienePermiso) {
                throw new Error('No tienes permisos para editar esta categoría');
            }

            const query = `
                UPDATE categoria 
                SET nombre = ?, fechaActualizacion = CURRENT_TIMESTAMP 
                WHERE idCategoria = ?
            `;
            const [result] = await db.execute(query, [categoriaData.nombre, id]);

            if (result.affectedRows === 0) {
                return null;
            }

            return await this.obtenerPorId(id, idUsuario);
        } catch (error) {
            throw new Error(`Error al actualizar categoría: ${error.message}`);
        }
    }

    // Eliminar categoría (verificando permisos)
    static async eliminar(id, idUsuario) {
        try {
            // Solo el propietario puede eliminar
            const query = 'SELECT idUsuario FROM categoria WHERE idCategoria = ?';
            const [rows] = await db.execute(query, [id]);

            if (rows.length === 0) {
                return false;
            }

            if (rows[0].idUsuario !== idUsuario) {
                throw new Error('Solo el propietario puede eliminar la categoría');
            }

            const deleteQuery = 'DELETE FROM categoria WHERE idCategoria = ?';
            const [result] = await db.execute(deleteQuery, [id]);

            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al eliminar categoría: ${error.message}`);
        }
    }

    // Obtener categoría con sus listas (incluyendo permisos)
    static async obtenerConListas(id, idUsuario) {
        try {
            const query = `
            SELECT 
                c.*, 
                cc.rol as rolCategoria,
                l.idLista, 
                l.nombre as nombreLista, 
                l.color, 
                l.icono,
                l.importante,
                l.compartible,
                l.claveCompartir,
                l.idUsuario as idUsuarioLista,
                l.fechaCreacion as fechaCreacionLista
            FROM categoria c
            LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                AND cc.idUsuario = ? 
                AND cc.activo = TRUE
            LEFT JOIN lista l ON c.idCategoria = l.idCategoria
            WHERE c.idCategoria = ? 
                AND (c.idUsuario = ? OR (cc.idUsuario = ? AND cc.activo = TRUE))
            ORDER BY l.importante DESC, l.nombre ASC
        `;
            const [rows] = await db.execute(query, [idUsuario, id, idUsuario, idUsuario]);

            if (rows.length === 0) {
                return null;
            }

            const categoria = {
                idCategoria: rows[0].idCategoria,
                nombre: rows[0].nombre,
                compartible: rows[0].compartible,
                tipoPrivacidad: rows[0].tipoPrivacidad,
                claveCompartir: rows[0].claveCompartir,
                rol: rows[0].rolCategoria || 'admin',
                listas: []
            };

            rows.forEach(row => {
                if (row.idLista) {
                    categoria.listas.push({
                        idLista: row.idLista,
                        nombre: row.nombreLista,
                        color: row.color,
                        icono: row.icono,
                        importante: row.importante,  // ✅ AGREGADO
                        compartible: row.compartible, // ✅ AGREGADO
                        claveCompartir: row.claveCompartir, // ✅ AGREGADO
                        idUsuario: row.idUsuarioLista, // ✅ AGREGADO
                        fechaCreacion: row.fechaCreacionLista
                    });
                }
            });

            return categoria;
        } catch (error) {
            throw new Error(`Error al obtener categoría con listas: ${error.message}`);
        }
    }
    // NUEVOS MÉTODOS PARA COMPARTIDOS

    // Verificar si usuario tiene permiso específico
    static async verificarPermiso(idCategoria, idUsuario, accion) {
        try {
            const query = `
                SELECT c.idUsuario as propietario, cc.rol
                FROM categoria c
                LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                    AND cc.idUsuario = ? 
                    AND cc.activo = TRUE
                WHERE c.idCategoria = ?
            `;
            const [rows] = await db.execute(query, [idUsuario, idCategoria]);

            if (rows.length === 0) return false;

            // Es propietario
            if (rows[0].propietario === idUsuario) return true;

            // Verificar rol
            const rol = rows[0].rol;
            if (!rol) return false;

            const { tienePermiso } = require('../utils/compartir.utils');
            return tienePermiso(rol, 'categoria', accion);
        } catch (error) {
            console.error('Error verificando permiso:', error);
            return false;
        }
    }

    // Obtener rol del usuario en la categoría
    static async obtenerRol(idCategoria, idUsuario) {
        try {
            const query = `
                SELECT 
                    c.idUsuario as propietario,
                    cc.rol,
                    cc.esCreador
                FROM categoria c
                LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                    AND cc.idUsuario = ? 
                    AND cc.activo = TRUE
                WHERE c.idCategoria = ?
            `;
            const [rows] = await db.execute(query, [idUsuario, idCategoria]);

            if (rows.length === 0) return null;

            if (rows[0].propietario === idUsuario) {
                return { rol: 'admin', esPropietario: true };
            }

            return {
                rol: rows[0].rol || null,
                esPropietario: false,
                esCreador: rows[0].esCreador || false
            };
        } catch (error) {
            console.error('Error obteniendo rol:', error);
            return null;
        }
    }

}

module.exports = Categoria;