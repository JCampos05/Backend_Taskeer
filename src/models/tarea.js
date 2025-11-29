const db = require('../config/config');

class Tarea {
    constructor(data) {
        this.idTarea = data.idTarea;
        this.nombre = data.nombre;
        this.descripcion = data.descripcion || null;
        this.prioridad = data.prioridad || 'N';
        this.estado = data.estado || 'P';
        this.fechaCreacion = data.fechaCreacion;
        this.fechaVencimiento = data.fechaVencimiento || null;
        this.miDia = Boolean(data.miDia) || false;
        this.pasos = data.pasos || null;
        this.notas = data.notas || null;
        this.recordatorio = data.recordatorio || null;
        this.repetir = Boolean(data.repetir) || false;
        this.tipoRepeticion = data.tipoRepeticion || null;
        this.configRepeticion = data.configRepeticion || null;
        this.idLista = data.idLista || null;
        this.idUsuarioAsignado = data.idUsuarioAsignado || null;
    }
    static async asignarUsuario(idTarea, idUsuarioAsignado, idUsuarioQuienAsigna) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // 1️⃣ Verificar que la tarea existe y obtener info
            const [tareaRows] = await connection.execute(
                `SELECT t.*, l.idUsuario as idPropietarioLista, l.nombre as nombreLista
                 FROM tarea t 
                 LEFT JOIN lista l ON t.idLista = l.idLista 
                 WHERE t.idTarea = ?`,
                [idTarea]
            );

            if (tareaRows.length === 0) {
                await connection.rollback();
                return { success: false, message: 'Tarea no encontrada' };
            }

            const tarea = tareaRows[0];

            // 2️⃣ Verificar que quien asigna es propietario o admin
            let puedeAsignar = false;

            // Es propietario de la lista
            if (tarea.idPropietarioLista === idUsuarioQuienAsigna) {
                puedeAsignar = true;
            } else if (tarea.idLista) {
                // Verificar si es admin en la lista compartida
                const [permisosRows] = await connection.execute(
                    `SELECT rol FROM lista_compartida 
                     WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [tarea.idLista, idUsuarioQuienAsigna]
                );

                if (permisosRows.length > 0 && permisosRows[0].rol === 'admin') {
                    puedeAsignar = true;
                }
            }

            if (!puedeAsignar) {
                await connection.rollback();
                return {
                    success: false,
                    message: 'Solo el propietario o administrador puede asignar tareas'
                };
            }

            // 3️⃣ Verificar que el usuario a asignar tiene acceso a la lista
            if (tarea.idLista) {
                const [accesoRows] = await connection.execute(
                    `SELECT rol FROM lista_compartida 
                     WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [tarea.idLista, idUsuarioAsignado]
                );

                if (accesoRows.length === 0 && tarea.idPropietarioLista !== idUsuarioAsignado) {
                    await connection.rollback();
                    return {
                        success: false,
                        message: 'El usuario no tiene acceso a esta lista'
                    };
                }
            }

            // 4️⃣ Asignar la tarea
            await connection.execute(
                'UPDATE tarea SET idUsuarioAsignado = ? WHERE idTarea = ?',
                [idUsuarioAsignado, idTarea]
            );

            // 5️⃣ Obtener nombre del usuario que asigna
            const [usuarioAsignaRows] = await connection.execute(
                'SELECT nombre FROM usuario WHERE idUsuario = ?',
                [idUsuarioQuienAsigna]
            );

            const nombreQuienAsigna = usuarioAsignaRows[0]?.nombre || 'Alguien';

            // 6️⃣ Crear notificación
            await connection.execute(
                `INSERT INTO notificaciones 
                    (id_usuario, tipo, titulo, mensaje, datos_adicionales, leida) 
                    VALUES (?, ?, ?, ?, ?, 0)`,
                [
                    idUsuarioAsignado,
                    'tarea_asignada',
                    'Nueva tarea asignada',
                    `${nombreQuienAsigna} te ha asignado la tarea "${tarea.nombre}"`,
                    JSON.stringify({
                        tareaId: idTarea,
                        tareaNombre: tarea.nombre,
                        listaId: tarea.idLista,
                        listaNombre: tarea.nombreLista,
                        asignadoPor: nombreQuienAsigna,
                        asignadoPorId: idUsuarioQuienAsigna
                    })
                ]
            );
            await connection.commit();

            // 7️⃣ Obtener tarea actualizada
            const [tareaActualizada] = await connection.execute(
                `SELECT t.*, 
                        u.nombre as nombreUsuarioAsignado,
                        u.email as emailUsuarioAsignado
                 FROM tarea t
                 LEFT JOIN usuario u ON t.idUsuarioAsignado = u.idUsuario
                 WHERE t.idTarea = ?`,
                [idTarea]
            );

            return {
                success: true,
                message: 'Tarea asignada exitosamente',
                tarea: tareaActualizada[0]
            };

        } catch (error) {
            await connection.rollback();
            console.error('Error al asignar tarea:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async desasignarUsuario(idTarea, idUsuarioQuienDesasigna) {
        try {
            // Verificar permisos (igual que en asignar)
            const { permiso } = await this.verificarPermisos(idTarea, idUsuarioQuienDesasigna, 'editar');

            if (!permiso) {
                return {
                    success: false,
                    message: 'No tienes permisos para desasignar esta tarea'
                };
            }

            await db.execute(
                'UPDATE tarea SET idUsuarioAsignado = NULL WHERE idTarea = ?',
                [idTarea]
            );

            return { success: true, message: 'Tarea desasignada exitosamente' };
        } catch (error) {
            console.error('Error al desasignar tarea:', error);
            throw error;
        }
    }


    // Método helper para verificar permisos
    static async verificarPermisos(idTarea, idUsuario, accion) {
        try {
            console.log(`🔍 Verificando permisos: tarea=${idTarea}, usuario=${idUsuario}, accion=${accion}`);

            const [tareaRows] = await db.execute(
                'SELECT t.*, l.idUsuario as idPropietarioLista FROM tarea t LEFT JOIN lista l ON t.idLista = l.idLista WHERE t.idTarea = ?',
                [idTarea]
            );

            if (tareaRows.length === 0) {
                console.log('❌ Tarea no encontrada');
                return { permiso: false, motivo: 'Tarea no encontrada' };
            }

            const tarea = tareaRows[0];
            console.log('📋 Tarea encontrada:', {
                idTarea: tarea.idTarea,
                idUsuario: tarea.idUsuario,
                idLista: tarea.idLista,
                idPropietarioLista: tarea.idPropietarioLista
            });

            // 1️⃣ Es propietario de la tarea
            if (tarea.idUsuario === idUsuario) {
                console.log('✅ Es propietario de la tarea');
                return { permiso: true, tarea };
            }

            // 2️⃣ Es propietario de la lista
            if (tarea.idPropietarioLista === idUsuario) {
                console.log('✅ Es propietario de la lista');
                return { permiso: true, tarea };
            }

            // 3️⃣ Verificar permisos compartidos
            if (tarea.idLista) {
                console.log('🔍 Verificando permisos compartidos en lista', tarea.idLista);

                const [permisosRows] = await db.execute(
                    `SELECT rol FROM lista_compartida 
                WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [tarea.idLista, idUsuario]
                );

                if (permisosRows.length > 0) {
                    const rol = permisosRows[0].rol;
                    console.log('👤 Rol encontrado:', rol);

                    const permisosRol = {
                        ver: ['admin', 'editor', 'colaborador', 'visor'],
                        editar: ['admin', 'editor', 'colaborador'],
                        eliminar: ['admin', 'editor']
                    };

                    if (permisosRol[accion]?.includes(rol)) {
                        console.log(`✅ Rol "${rol}" tiene permiso para "${accion}"`);
                        return { permiso: true, tarea, rol };
                    }

                    console.log(`❌ Rol "${rol}" NO tiene permiso para "${accion}"`);
                    return { permiso: false, motivo: `Rol "${rol}" no permite ${accion}`, rol };
                }

                console.log('❌ No hay permisos compartidos');
            }

            console.log('❌ Sin permisos');
            return { permiso: false, motivo: 'Sin permisos' };

        } catch (error) {
            console.error('❌ Error en verificarPermisos:', error);
            return { permiso: false, motivo: 'Error al verificar permisos', error: error.message };
        }
    }
    static async crear(tareaData) {
        try {
            const query = `
                INSERT INTO tarea (
                    nombre, descripcion, prioridad, estado, fechaVencimiento, 
                    miDia, pasos, notas, recordatorio, repetir, tipoRepeticion, 
                    configRepeticion, idLista, idUsuario, idUsuarioAsignado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await db.execute(query, [
                tareaData.nombre,
                tareaData.descripcion || null,
                tareaData.prioridad || 'N',
                tareaData.estado || 'P',
                tareaData.fechaVencimiento || null,
                tareaData.miDia || false,
                tareaData.pasos || null,
                tareaData.notas || null,
                tareaData.recordatorio || null,
                tareaData.repetir || false,
                tareaData.tipoRepeticion || null,
                tareaData.configRepeticion || null,
                tareaData.idLista || null,
                tareaData.idUsuario,
                tareaData.idUsuarioAsignado || null
            ]);

            return {
                idTarea: result.insertId,
                ...tareaData,
                fechaCreacion: new Date()
            };
        } catch (error) {
            throw new Error(`Error al crear tarea: ${error.message}`);
        }
    }

    // Actualizar queries para incluir info del usuario asignado
    static async obtenerTodas(idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE (
                t.idUsuario = ?
                OR t.idUsuarioAsignado = ?
                OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
            )
            ORDER BY t.fechaCreacion DESC
        `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, idUsuario, idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas: ${error.message}`);
        }
    }

    // Obtener tarea por ID CON información de la lista
    static async obtenerPorId(id, idUsuario) {
        try {
            const { permiso } = await this.verificarPermisos(id, idUsuario, 'ver');

            if (!permiso) {
                return null;
            }

            const query = `
            SELECT 
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                u.nombre as nombreUsuarioAsignado,
                u.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario u ON t.idUsuarioAsignado = u.idUsuario
            WHERE t.idTarea = ?
        `;
            const [rows] = await db.execute(query, [idUsuario, id]);

            if (rows.length === 0) {
                return null;
            }

            return rows[0];
        } catch (error) {
            throw new Error(`Error al obtener tarea: ${error.message}`);
        }
    }

    // ✅ NUEVO: Obtener usuarios disponibles para asignar en una lista
    static async obtenerUsuariosDisponibles(idLista, idUsuarioSolicitante) {
        try {
            // Verificar que el solicitante es propietario o admin
            const [listaRows] = await db.execute(
                'SELECT idUsuario FROM lista WHERE idLista = ?',
                [idLista]
            );

            if (listaRows.length === 0) {
                return { success: false, message: 'Lista no encontrada' };
            }

            const idPropietario = listaRows[0].idUsuario;
            let esAdmin = idPropietario === idUsuarioSolicitante;

            if (!esAdmin) {
                const [permisosRows] = await db.execute(
                    `SELECT rol FROM lista_compartida 
                     WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [idLista, idUsuarioSolicitante]
                );

                if (permisosRows.length > 0 && permisosRows[0].rol === 'admin') {
                    esAdmin = true;
                }
            }

            if (!esAdmin) {
                return {
                    success: false,
                    message: 'Solo propietarios y administradores pueden ver usuarios disponibles'
                };
            }

            // Obtener todos los usuarios con acceso a la lista
            const [usuarios] = await db.execute(
                `SELECT DISTINCT u.idUsuario, u.nombre, u.email, lc.rol,
                    (u.idUsuario = ?) as esPropietario
                    FROM usuario u
                    LEFT JOIN lista_compartida lc ON u.idUsuario = lc.idUsuario AND lc.idLista = ?
                    WHERE (u.idUsuario = ? OR (lc.activo = TRUE AND lc.aceptado = TRUE))
                    ORDER BY esPropietario DESC, u.nombre ASC`,
                [idPropietario, idLista, idPropietario]
            );

            return { success: true, usuarios };

        } catch (error) {
            console.error('Error al obtener usuarios disponibles:', error);
            throw error;
        }
    }


    static async actualizar(id, tareaData, idUsuario) {
        try {
            const { permiso, tarea, motivo } = await this.verificarPermisos(id, idUsuario, 'editar');

            if (!permiso) {
                console.log('❌ Sin permisos para actualizar:', motivo);
                return null;
            }
            const campos = [];
            const valores = [];

            if (tareaData.nombre !== undefined) {
                campos.push('nombre = ?');
                valores.push(tareaData.nombre);
            }
            if (tareaData.descripcion !== undefined) {
                campos.push('descripcion = ?');
                valores.push(tareaData.descripcion);
            }
            if (tareaData.prioridad !== undefined) {
                campos.push('prioridad = ?');
                valores.push(tareaData.prioridad);
            }
            if (tareaData.estado !== undefined) {
                campos.push('estado = ?');
                valores.push(tareaData.estado);
            }
            if (tareaData.fechaVencimiento !== undefined) {
                campos.push('fechaVencimiento = ?');
                valores.push(tareaData.fechaVencimiento);
            }
            if (tareaData.miDia !== undefined) {
                campos.push('miDia = ?');
                valores.push(tareaData.miDia);
            }
            if (tareaData.pasos !== undefined) {
                campos.push('pasos = ?');
                valores.push(tareaData.pasos);
            }
            if (tareaData.notas !== undefined) {
                campos.push('notas = ?');
                valores.push(tareaData.notas);
            }
            if (tareaData.recordatorio !== undefined) {
                campos.push('recordatorio = ?');
                valores.push(tareaData.recordatorio);
            }
            if (tareaData.repetir !== undefined) {
                campos.push('repetir = ?');
                valores.push(tareaData.repetir);
            }
            if (tareaData.tipoRepeticion !== undefined) {
                campos.push('tipoRepeticion = ?');
                valores.push(tareaData.tipoRepeticion);
            }
            if (tareaData.configRepeticion !== undefined) {
                campos.push('configRepeticion = ?');
                valores.push(tareaData.configRepeticion);
            }
            if (tareaData.idLista !== undefined) {
                campos.push('idLista = ?');
                valores.push(tareaData.idLista);
            }

            if (campos.length === 0) {
                throw new Error('No hay campos para actualizar');
            }

            valores.push(id);
            //valores.push(idUsuario);
            const query = `UPDATE tarea SET ${campos.join(', ')} WHERE idTarea = ?`;

            const [result] = await db.execute(query, valores);

            if (result.affectedRows === 0) {
                return null;
            }
            // Retornar tarea actualizada
            const [tareaActualizada] = await db.execute(
                `SELECT t.*, l.nombre as nombreLista, l.icono as iconoLista, 
                    l.color as colorLista, l.importante as importante
                    FROM tarea t LEFT JOIN lista l ON t.idLista = l.idLista 
                    WHERE t.idTarea = ?`,
                [id]
            );

            return tareaActualizada[0];
            //return await this.obtenerPorId(id, idUsuario);
        } catch (error) {
            throw new Error(`Error al actualizar tarea: ${error.message}`);
        }
    }

    // Eliminar tarea
    static async eliminar(id, idUsuario) {
        try {
            // ✅ Verificar permisos primero (solo admin y editor pueden eliminar)
            const { permiso, motivo } = await this.verificarPermisos(id, idUsuario, 'eliminar');

            if (!permiso) {
                console.log('❌ Sin permisos para eliminar:', motivo);
                return false;
            }

            // ✅ Eliminar SIN filtro de idUsuario
            const query = 'DELETE FROM tarea WHERE idTarea = ?';
            const [result] = await db.execute(query, [id]);

            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error al eliminar tarea: ${error.message}`);
        }
    }

    // Cambiar estado de tarea
    static async cambiarEstado(id, estado, idUsuario) {
        try {
            console.log('🔧 Tarea.cambiarEstado:', { id, estado, idUsuario });

            // 1️⃣ Primero obtener la tarea para saber si está en una lista
            const [tareaRows] = await db.execute(
                'SELECT t.*, l.idUsuario as idPropietarioLista FROM tarea t LEFT JOIN lista l ON t.idLista = l.idLista WHERE t.idTarea = ?',
                [id]
            );

            if (tareaRows.length === 0) {
                console.log('❌ Tarea no encontrada:', id);
                return null;
            }

            const tarea = tareaRows[0];
            console.log('📋 Tarea encontrada:', { idTarea: tarea.idTarea, idUsuario: tarea.idUsuario, idLista: tarea.idLista });

            // 2️⃣ Verificar permisos
            let tienePermiso = false;

            // Es el propietario de la tarea
            if (tarea.idUsuario === idUsuario) {
                console.log('✅ Es propietario de la tarea');
                tienePermiso = true;
            }
            // Es el propietario de la lista
            else if (tarea.idPropietarioLista === idUsuario) {
                console.log('✅ Es propietario de la lista');
                tienePermiso = true;
            }
            // Verificar permisos compartidos
            else if (tarea.idLista) {
                const [permisosRows] = await db.execute(
                    `SELECT rol FROM lista_compartida 
         WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [tarea.idLista, idUsuario]
                );

                if (permisosRows.length > 0) {
                    const rol = permisosRows[0].rol;
                    console.log('🔍 Rol en lista compartida:', rol);

                    // admin, editor, colaborador pueden editar
                    if (['admin', 'editor', 'colaborador'].includes(rol)) {
                        console.log('✅ Tiene permisos por rol compartido');
                        tienePermiso = true;
                    }
                }
            }

            if (!tienePermiso) {
                console.log('❌ Sin permisos para modificar esta tarea');
                return null;
            }

            // 3️⃣ Actualizar estado
            console.log('💾 Actualizando estado en BD...');
            const [result] = await db.execute(
                'UPDATE tarea SET estado = ? WHERE idTarea = ?',
                [estado, id]
            );

            if (result.affectedRows === 0) {
                console.log('❌ No se actualizó ninguna fila');
                return null;
            }

            console.log('✅ Estado actualizado correctamente');

            // 4️⃣ Retornar tarea actualizada
            const [tareaActualizada] = await db.execute(
                'SELECT * FROM tarea WHERE idTarea = ?',
                [id]
            );

            return tareaActualizada[0];

        } catch (error) {
            console.error('❌ Error en Tarea.cambiarEstado:', error);
            throw error;
        }
    }

    // Obtener tareas por estado CON información de la lista
    static async obtenerPorEstado(estado, idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE t.estado = ? 
                AND (
                    t.idUsuario = ?
                    OR t.idUsuarioAsignado = ?
                    OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
                )
            ORDER BY t.fechaCreacion DESC
        `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, estado, idUsuario, idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas por estado: ${error.message}`);
        }
    }

    // Obtener tareas por prioridad CON información de la lista
    static async obtenerPorPrioridad(prioridad, idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE t.prioridad = ? 
                AND (
                    t.idUsuario = ?
                    OR t.idUsuarioAsignado = ?
                    OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
                )
            ORDER BY t.fechaCreacion DESC
        `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, prioridad, idUsuario, idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas por prioridad: ${error.message}`);
        }
    }

    // Obtener tareas vencidas CON información de la lista
    static async obtenerVencidas(idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE t.fechaVencimiento < CURDATE() 
                AND t.estado != 'C'
                AND (
                    t.idUsuario = ?
                    OR t.idUsuarioAsignado = ?
                    OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
                )
            ORDER BY t.fechaVencimiento ASC
        `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, idUsuario, idUsuario]);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas vencidas: ${error.message}`);
        }
    }
    // Obtener tareas por lista CON información de la lista
    static async obtenerPorLista(idLista, idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                --  CRÍTICO: Forzar conversión explícita a INT para que Angular detecte el cambio
                CAST(EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) AS UNSIGNED) as miDia
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE t.idLista = ? 
                AND (
                    t.idUsuario = ?
                    OR t.idUsuarioAsignado = ?
                    OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
                )
            ORDER BY t.fechaCreacion DESC
        `;
            const [rows] = await db.execute(query, [idUsuario, idUsuario, idLista, idUsuario, idUsuario]);

            console.log('🔍 Tareas desde BD (obtenerPorLista):', rows.map(t => ({
                id: t.idTarea,
                nombre: t.nombre,
                miDia: t.miDia,
                tipo: typeof t.miDia
            })));

            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas por lista: ${error.message}`);
        }
    }

    // Nuevo método para alternar Mi Día
    static async alternarMiDia(id, miDia, idUsuario) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // Verificar permisos
            const { permiso } = await this.verificarPermisos(id, idUsuario, 'ver');

            if (!permiso) {
                await connection.rollback();
                return null;
            }

            if (miDia) {
                // ✅ Agregar a Mi Día (solo para este usuario)
                await connection.execute(
                    `INSERT INTO tarea_mi_dia (idTarea, idUsuario, fechaAgregado) 
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE fechaAgregado = NOW()`,
                    [id, idUsuario]
                );
            } else {
                // ✅ Quitar de Mi Día (solo para este usuario)
                await connection.execute(
                    'DELETE FROM tarea_mi_dia WHERE idTarea = ? AND idUsuario = ?',
                    [id, idUsuario]
                );
            }

            await connection.commit();

            // ✅ Retornar tarea actualizada con estado de Mi Día para este usuario
            const [tareaActualizada] = await connection.execute(
                `SELECT 
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
             FROM tarea t
             LEFT JOIN lista l ON t.idLista = l.idLista
             LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
             WHERE t.idTarea = ?`,
                [idUsuario, id]
            );

            return tareaActualizada[0];

        } catch (error) {
            await connection.rollback();
            console.error('Error al alternar Mi Día:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Nuevo método para obtener tareas de Mi Día
    static async obtenerMiDia(idUsuario) {
        try {
            const query = `
            SELECT DISTINCT
                t.*,
                l.nombre as nombreLista,
                l.icono as iconoLista,
                l.color as colorLista,
                l.importante as importante,
                ua.nombre as nombreUsuarioAsignado,
                ua.email as emailUsuarioAsignado,
                TRUE as miDia
            FROM tarea t
            INNER JOIN tarea_mi_dia tmd ON t.idTarea = tmd.idTarea
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
            LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? 
                AND lc.activo = 1 
                AND lc.aceptado = 1
            WHERE tmd.idUsuario = ?
                AND t.estado != 'C'
                AND (
                    -- ✅ FILTRO CRÍTICO: Solo tareas sin asignar O asignadas a este usuario
                    t.idUsuarioAsignado IS NULL 
                    OR t.idUsuarioAsignado = ?
                )
                AND (
                    -- Tareas propias
                    t.idUsuario = ?
                    -- O tareas de listas compartidas donde tengo acceso
                    OR (l.idLista IS NOT NULL AND lc.idUsuario IS NOT NULL)
                )
            ORDER BY t.fechaCreacion DESC
        `;

            // ✅ Ahora necesitamos 4 parámetros (idUsuario se usa 4 veces)
            const [rows] = await db.execute(query, [idUsuario, idUsuario, idUsuario, idUsuario]);

            //console.log(`🌞 Mi Día para usuario ${idUsuario}: ${rows.length} tareas`);

            return rows;
        } catch (error) {
            throw new Error(`Error al obtener tareas de Mi Día: ${error.message}`);
        }
    }

    // ✅ NUEVO: Obtener TODAS las tareas de una lista (sin filtrar por usuario)
    static async obtenerTodasPorLista(idLista, idUsuarioSolicitante) {
        try {
            // Verificar que el usuario tiene acceso a la lista
            const [listaRows] = await db.execute(
                'SELECT idUsuario FROM lista WHERE idLista = ?',
                [idLista]
            );

            if (listaRows.length === 0) {
                return { success: false, message: 'Lista no encontrada' };
            }

            const idPropietario = listaRows[0].idUsuario;
            let tieneAcceso = idPropietario === idUsuarioSolicitante;

            if (!tieneAcceso) {
                const [permisosRows] = await db.execute(
                    `SELECT rol FROM lista_compartida 
                 WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [idLista, idUsuarioSolicitante]
                );

                if (permisosRows.length > 0) {
                    tieneAcceso = true;
                }
            }

            if (!tieneAcceso) {
                return { success: false, message: 'No tienes acceso a esta lista' };
            }

            // ✅ Obtener TODAS las tareas de la lista CON miDia personalizado
            const [tareas] = await db.execute(
                `SELECT 
                t.*,
                u.nombre as nombreUsuarioAsignado,
                u.email as emailUsuarioAsignado,
                uc.nombre as nombreCreador,
                EXISTS(
                    SELECT 1 FROM tarea_mi_dia tmd 
                    WHERE tmd.idTarea = t.idTarea 
                      AND tmd.idUsuario = ?
                ) as miDia
            FROM tarea t
            LEFT JOIN usuario u ON t.idUsuarioAsignado = u.idUsuario
            LEFT JOIN usuario uc ON t.idUsuario = uc.idUsuario
            WHERE t.idLista = ?
            ORDER BY t.fechaCreacion DESC`,
                [idUsuarioSolicitante, idLista]
            );

            return { success: true, tareas };

        } catch (error) {
            console.error('Error al obtener todas las tareas de lista:', error);
            throw error;
        }
    }

    static agregarMiDiaAQuery(queryBase, idUsuario) {
        return `
        SELECT DISTINCT
            t.*,
            l.nombre as nombreLista,
            l.icono as iconoLista,
            l.color as colorLista,
            l.importante as importante,
            ua.nombre as nombreUsuarioAsignado,
            ua.email as emailUsuarioAsignado,
            EXISTS(
                SELECT 1 FROM tarea_mi_dia tmd 
                WHERE tmd.idTarea = t.idTarea 
                  AND tmd.idUsuario = ?
            ) as miDia
        FROM (${queryBase}) t
        LEFT JOIN lista l ON t.idLista = l.idLista
        LEFT JOIN usuario ua ON t.idUsuarioAsignado = ua.idUsuario
    `;
    }
}

module.exports = Tarea;