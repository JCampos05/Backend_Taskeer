const db = require('../config/config');

class Lista {
    constructor(data) {
        this.idLista = data.idLista;
        this.nombre = data.nombre;
        this.color = data.color || null;
        this.icono = data.icono || null;
        this.idCategoria = data.idCategoria || null;
        this.fechaCreacion = data.fechaCreacion;
        this.importante = Boolean(data.importante) || false;
    }

    // Crear una nueva lista
    static async crear(listaData) {
        try {
            const query = `
            INSERT INTO lista (nombre, color, icono, importante, idCategoria, idUsuario, compartible)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

            const [result] = await db.execute(query, [
                listaData.nombre,
                listaData.color || null,
                listaData.icono || null,
                Boolean(listaData.importante) ? 1 : 0,
                listaData.idCategoria || null,
                listaData.idUsuario,
                Boolean(listaData.compartible) ? 1 : 0
                // Ya no necesitamos pasar compartible, está hardcoded como TRUE en el query
            ]);

            return {
                idLista: result.insertId,
                ...listaData,
                compartible: Boolean(listaData.compartible),  //  Asegurar que el objeto devuelto tenga compartible
                fechaCreacion: new Date()
            };
        } catch (error) {
            throw new Error(`Error al crear lista: ${error.message}`);
        }
    }

    // Obtener todas las listas
    // En lista.js - REEMPLAZAR obtenerTodas
    // En lista.js - MODIFICAR el método obtenerTodas()

    // En lista.js - MODIFICAR el método obtenerTodas()

    static async obtenerTodas(idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                l.*,
                c.nombre as nombreCategoria,
                CASE 
                    WHEN l.idUsuario = ? THEN TRUE
                    ELSE FALSE
                END as esPropietario,
                CASE 
                    WHEN lc.idUsuario = ? AND lc.activo = TRUE AND lc.aceptado = TRUE THEN TRUE
                    ELSE FALSE
                END as esCompartidaConmigo,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM lista_compartida lc2 
                        WHERE lc2.idLista = l.idLista AND lc2.activo = TRUE
                    ) THEN TRUE
                    ELSE FALSE
                END as esCompartida
            FROM lista l
            LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista AND lc.idUsuario = ?
            WHERE l.idUsuario = ? 
               OR (lc.idUsuario = ? AND lc.activo = TRUE AND lc.aceptado = TRUE)
            ORDER BY l.fechaCreacion DESC
        `;

            const [rows] = await db.execute(query, [
                idUsuario,
                idUsuario,
                idUsuario,
                idUsuario,
                idUsuario
            ]);

            return rows.map(row => ({
                idLista: row.idLista,
                nombre: row.nombre,
                color: row.color,
                icono: row.icono,
                // ✅ CORRECCIÓN: Convertir explícitamente a booleano
                importante: Boolean(row.importante),
                compartible: row.compartible,
                claveCompartir: row.claveCompartir,
                idCategoria: row.idCategoria,
                nombreCategoria: row.nombreCategoria,
                idUsuario: row.idUsuario,
                esPropietario: !!row.esPropietario,
                esCompartidaConmigo: !!row.esCompartidaConmigo,
                esCompartida: !!row.esCompartida,
                fechaCreacion: row.fechaCreacion,
                fechaActualizacion: row.fechaActualizacion
            }));
        } catch (error) {
            throw new Error(`Error al obtener listas: ${error.message}`);
        }
    }

    // Obtener lista por ID
    // En lista.js - MODIFICAR obtenerPorId()

    static async obtenerPorId(id, idUsuario = null) {
        try {
            let query, params;

            if (idUsuario !== null) {
                query = `
                SELECT l.*, c.nombre as nombreCategoria
                FROM lista l
                LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
                WHERE l.idLista = ? AND l.idUsuario = ?
            `;
                params = [id, idUsuario];
            } else {
                query = `
                SELECT l.*, c.nombre as nombreCategoria
                FROM lista l
                LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
                WHERE l.idLista = ?
            `;
                params = [id];
            }

            const [rows] = await db.execute(query, params);

            if (rows.length === 0) {
                return null;
            }

            // ✅ CORRECCIÓN: Convertir importante a booleano antes de devolver
            const lista = rows[0];
            return {
                ...lista,
                importante: Boolean(lista.importante) // ✅ Conversión explícita
            };
        } catch (error) {
            throw new Error(`Error al obtener lista: ${error.message}`);
        }
    }

    // Actualizar lista
    static async actualizar(id, listaData, idUsuario) {
        try {
            const campos = [];
            const valores = [];

            if (listaData.nombre !== undefined) {
                campos.push('nombre = ?');
                valores.push(listaData.nombre);
            }
            if (listaData.color !== undefined) {
                campos.push('color = ?');
                valores.push(listaData.color);
            }
            if (listaData.icono !== undefined) {
                campos.push('icono = ?');
                valores.push(listaData.icono);
            }
            if (listaData.importante !== undefined) {
                campos.push('importante = ?');
                valores.push(listaData.importante);
            }
            if (listaData.idCategoria !== undefined) {
                campos.push('idCategoria = ?');
                valores.push(listaData.idCategoria);
            }

            if (campos.length === 0) {
                throw new Error('No hay campos para actualizar');
            }

            valores.push(id);
            const query = `UPDATE lista SET ${campos.join(', ')} WHERE idLista = ? AND idUsuario = ?`;
            valores.push(idUsuario);

            const [result] = await db.execute(query, valores);

            if (result.affectedRows === 0) {
                return null;
            }

            return await this.obtenerPorId(id, idUsuario);
        } catch (error) {
            throw new Error(`Error al actualizar lista: ${error.message}`);
        }
    }

    // Eliminar lista
    static async eliminar(id, idUsuario) {
        try {
            const query = 'DELETE FROM lista WHERE idLista = ? AND idUsuario = ?';
            const [result] = await db.execute(query, [id, idUsuario]);

            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al eliminar lista: ${error.message}`);
        }
    }

    // Obtener lista con sus tareas
    static async obtenerConTareas(id, idUsuario = null) {
        try {
            let query, params;

            // CRÍTICO: Necesitamos idUsuario para obtener miDia personalizado
            // El controlador debe pasar req.usuario.idUsuario
            const usuarioParaMiDia = idUsuario || 0; // Fallback si no viene

            // Query actualizada con campo miDia
            query = `
            SELECT 
                l.*, 
                c.nombre as nombreCategoria,
                t.idTarea, 
                t.nombre as nombreTarea, 
                t.descripcion, 
                t.prioridad, 
                t.estado, 
                t.fechaCreacion as fechaCreacionTarea, 
                t.fechaVencimiento,
                t.miDia as miDiaLegacy,
                t.repetir,
                t.pasos,
                t.notas,
                t.recordatorio,
                t.tipoRepeticion,
                t.configRepeticion,
                t.idUsuarioAsignado, 
                u.nombre as nombreUsuarioAsignado, 
                u.email as emailUsuarioAsignado,
                -- ✅ Campo miDia personalizado por usuario
                CAST(EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) AS UNSIGNED) as miDia
            FROM lista l
            LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
            LEFT JOIN tarea t ON l.idLista = t.idLista
            LEFT JOIN usuario u ON t.idUsuarioAsignado = u.idUsuario
            WHERE l.idLista = ?
            ORDER BY t.fechaCreacion DESC
        `;

            params = [usuarioParaMiDia, id];

            console.log('🔍 Query obtenerConTareas:', { idLista: id, idUsuario: usuarioParaMiDia });

            const [rows] = await db.execute(query, params);

            if (rows.length === 0) {
                return null;
            }

            const lista = {
                idLista: rows[0].idLista,
                nombre: rows[0].nombre,
                color: rows[0].color,
                icono: rows[0].icono,
                idCategoria: rows[0].idCategoria,
                nombreCategoria: rows[0].nombreCategoria,
                fechaCreacion: rows[0].fechaCreacion,
                importante: Boolean(rows[0].importante),
                compartible: rows[0].compartible,
                claveCompartir: rows[0].claveCompartir,
                tareas: []
            };

            // ✅ Mapear tareas con miDia normalizado
            rows.forEach(row => {
                if (row.idTarea) {
                    const tarea = {
                        idTarea: row.idTarea,
                        nombre: row.nombreTarea,
                        descripcion: row.descripcion,
                        prioridad: row.prioridad,
                        estado: row.estado,
                        fechaCreacion: row.fechaCreacionTarea,
                        fechaVencimiento: row.fechaVencimiento,
                        miDia: Boolean(row.miDia === 1 || row.miDia === true), // ✅ Conversión explícita
                        repetir: Boolean(row.repetir === 1 || row.repetir === true),
                        pasos: row.pasos,
                        notas: row.notas,
                        recordatorio: row.recordatorio,
                        tipoRepeticion: row.tipoRepeticion,
                        configRepeticion: row.configRepeticion,
                        idUsuarioAsignado: row.idUsuarioAsignado,
                        nombreUsuarioAsignado: row.nombreUsuarioAsignado,
                        emailUsuarioAsignado: row.emailUsuarioAsignado,
                        // Campos de lista
                        nombreLista: lista.nombre,
                        iconoLista: lista.icono,
                        colorLista: lista.color,
                        importante: lista.importante
                    };

                    console.log(`📋 Tarea ${tarea.idTarea} - miDia:`, {
                        valorBD: row.miDia,
                        valorNormalizado: tarea.miDia,
                        tipo: typeof tarea.miDia
                    });

                    lista.tareas.push(tarea);
                }
            });

            console.log(`✅ Lista cargada con ${lista.tareas.length} tareas. IDs:`,
                lista.tareas.map(t => `${t.idTarea}(miDia:${t.miDia})`).join(', ')
            );

            return lista;
        } catch (error) {
            console.error('❌ Error en obtenerConTareas:', error);
            throw new Error(`Error al obtener lista con tareas: ${error.message}`);
        }
    }


    static async obtenerPorCategoria(idCategoria, idUsuario) {
        try {
            const query = `
            SELECT 
                l.idLista,
                l.nombre,
                l.color,
                l.icono,
                l.importante,
                l.compartible,
                l.claveCompartir,
                l.idCategoria,
                l.idUsuario,
                l.fechaCreacion,
                l.fechaActualizacion,
                c.nombre as nombreCategoria
            FROM lista l
            LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
            WHERE l.idCategoria = ? AND l.idUsuario = ?
            ORDER BY l.nombre ASC
        `;
            const [rows] = await db.execute(query, [idCategoria, idUsuario]);

            // ✅ CORRECCIÓN: Mapear explícitamente importante como booleano
            return rows.map(row => ({
                idLista: row.idLista,
                nombre: row.nombre,
                color: row.color,
                icono: row.icono,
                importante: Boolean(row.importante), // ✅ Conversión explícita
                compartible: row.compartible,
                claveCompartir: row.claveCompartir,
                idCategoria: row.idCategoria,
                nombreCategoria: row.nombreCategoria,
                idUsuario: row.idUsuario,
                fechaCreacion: row.fechaCreacion,
                fechaActualizacion: row.fechaActualizacion
            }));
        } catch (error) {
            throw new Error(`Error al obtener listas por categoría: ${error.message}`);
        }
    }

    // Contar tareas de una lista
    static async contarTareas(id, idUsuario = null) {
        try {
            let query, params;

            // ✅ Las tareas SÍ tienen idUsuario propio, así que siempre filtramos por lista
            // El middleware ya verificó que el usuario tiene acceso a la lista
            if (idUsuario !== null) {
                query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'C' THEN 1 ELSE 0 END) as completadas,
                    SUM(CASE WHEN estado = 'P' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN estado = 'N' THEN 1 ELSE 0 END) as enProgreso
                FROM tarea
                WHERE idLista = ? AND idUsuario = ?
            `;
                params = [id, idUsuario];
            } else {
                // ✅ Sin verificar usuario, contamos todas las tareas de la lista
                query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'C' THEN 1 ELSE 0 END) as completadas,
                    SUM(CASE WHEN estado = 'P' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN estado = 'N' THEN 1 ELSE 0 END) as enProgreso
                FROM tarea
                WHERE idLista = ?
            `;
                params = [id];
            }

            const [rows] = await db.execute(query, params);
            return rows[0];
        } catch (error) {
            throw new Error(`Error al contar tareas: ${error.message}`);
        }
    }

    // Obtener listas sin categoría
    static async obtenerSinCategoria(idUsuario) {
        try {
            const query = `
                SELECT l.*
                FROM lista l
                WHERE l.idCategoria IS NULL AND l.idUsuario = ?
                ORDER BY l.nombre ASC
            `;
            const [rows] = await db.execute(query, [idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener listas sin categoría: ${error.message}`);
        }
    }
    // Obtener listas importantes
    static async obtenerImportantes(idUsuario) {
        try {
            const query = `
                SELECT l.*, c.nombre as nombreCategoria
                FROM lista l
                LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
                WHERE l.importante = TRUE AND l.idUsuario = ?
                ORDER BY l.nombre ASC
            `;
            const [rows] = await db.execute(query, [idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener listas importantes: ${error.message}`);
        }
    }
}

module.exports = Lista;