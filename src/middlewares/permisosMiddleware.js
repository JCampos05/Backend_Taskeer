const db = require('../config/config');

/**
 * Verifica si el usuario es admin/propietario de una categoría
 */
const esAdminCategoria = async (req, res, next) => {
    try {
        const { idCategoria } = req.params;
        const idUsuario = req.usuario.idUsuario;

        if (!idCategoria) {
            return res.status(400).json({ error: 'ID de categoría requerido' });
        }

        // Verificar si es el propietario
        const [rows] = await db.execute(
            'SELECT * FROM categoria WHERE idCategoria = ? AND idUsuario = ?',
            [idCategoria, idUsuario]
        );

        if (rows.length > 0) {
            return next(); // Es el propietario
        }

        // Verificar si tiene rol admin en categoría compartida
        const [compartido] = await db.execute(
            `SELECT * FROM categoria_compartida 
             WHERE idCategoria = ? AND idUsuario = ? AND rol = 'admin' AND activo = TRUE`,
            [idCategoria, idUsuario]
        );

        if (compartido.length > 0) {
            return next();
        }

        return res.status(403).json({ error: 'No tienes permisos de administrador en esta categoría' });
    } catch (error) {
        console.error('Error en middleware esAdminCategoria:', error);
        return res.status(500).json({ error: 'Error al verificar permisos' });
    }
};

/**
 * Verifica si el usuario es admin/propietario de una lista
 */
const esAdminLista = async (req, res, next) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario;

        console.log(`🔐 Verificando si es admin de lista ${idLista}`);

        // 1️⃣ Verificar si es propietario
        const [listaRows] = await db.execute(
            'SELECT idUsuario FROM lista WHERE idLista = ?',
            [idLista]
        );

        if (listaRows.length === 0) {
            return res.status(404).json({
                error: 'Lista no encontrada'
            });
        }

        if (listaRows[0].idUsuario === idUsuario) {
            console.log('✅ Es propietario de la lista');
            return next();
        }

        // 2️⃣ Verificar si tiene rol admin en lista compartida
        const [permisosRows] = await db.execute(
            `SELECT rol FROM lista_compartida 
       WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
            [idLista, idUsuario]
        );

        if (permisosRows.length > 0 && permisosRows[0].rol === 'admin') {
            console.log('✅ Tiene rol admin en lista compartida');
            return next();
        }

        console.log('❌ Usuario no es admin de la lista');
        return res.status(403).json({
            error: 'No tienes permisos de administrador en esta lista'
        });

    } catch (error) {
        console.error('❌ Error en esAdminLista:', error);
        return res.status(500).json({
            error: 'Error al verificar permisos',
            detalles: error.message
        });
    }
};

/**
 * Verifica permisos sobre una categoría (propias o compartidas)
 * @param {string} accion - 'ver', 'editar', 'eliminar', 'compartir'
 */
const verificarPermisoCategoria = (accion) => {
    return async (req, res, next) => {
        try {
            const { idCategoria } = req.params;
            const idUsuario = req.usuario.idUsuario;

            // Obtener la categoría
            const [categoriaRows] = await db.execute(
                'SELECT * FROM categoria WHERE idCategoria = ?',
                [idCategoria]
            );

            if (categoriaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Categoría no encontrada'
                });
            }

            const categoria = categoriaRows[0];

            // Si es el propietario, tiene todos los permisos (recursos propios)
            if (categoria.idUsuario === idUsuario) {
                req.permisos = {
                    esCreador: true,
                    esPropietario: true,
                    rol: 'propietario',
                    puede: { ver: true, editar: true, eliminar: true, compartir: true }
                };
                req.categoria = categoria;
                return next();
            }

            // Si no es propietario, verificar acceso compartido
            const [categoriaCompartida] = await db.execute(
                `SELECT rol FROM categoria_compartida 
                 WHERE idCategoria = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                [idCategoria, idUsuario]
            );

            if (categoriaCompartida.length > 0) {
                const rol = categoriaCompartida[0].rol;
                const permisos = obtenerPermisosPorRol(rol);

                if (permisos[accion]) {
                    req.permisos = {
                        esCreador: false,
                        esPropietario: false,
                        rol,
                        puede: permisos,
                        esCompartida: true
                    };
                    req.categoria = categoria;
                    return next();
                }

                // Tiene acceso pero no el permiso necesario
                return res.status(403).json({
                    success: false,
                    error: `Tu rol de "${rol}" no permite ${accion} esta categoría`
                });
            }

            // No tiene acceso en absoluto
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a esta categoría'
            });
        } catch (error) {
            console.error('Error en verificarPermisoCategoria:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al verificar permisos'
            });
        }
    };
};

/**
 * Verifica permisos sobre una lista (propias o compartidas, incluyendo herencia de categoría)
 * @param {string} accion - 'ver', 'editar', 'eliminar', 'compartir'
 */
const verificarPermisoLista = (accion) => {
    return async (req, res, next) => {
        try {
            const { idLista } = req.params;
            const idUsuario = req.usuario.idUsuario;

            if (!idLista) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de lista requerido'
                });
            }

            // Obtener la lista con información de categoría
            const [listaRows] = await db.execute(
                `SELECT l.*, c.idUsuario as idUsuarioCategoria
                 FROM lista l
                 LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
                 WHERE l.idLista = ?`,
                [idLista]
            );

            if (listaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Lista no encontrada'
                });
            }

            const lista = listaRows[0];

            // Si es el propietario de la lista, tiene todos los permisos (recursos propios)
            if (lista.idUsuario === idUsuario) {
                req.permisos = {
                    esCreador: true,
                    esPropietario: true,
                    rol: 'propietario',
                    puede: { ver: true, editar: true, eliminar: true, mover: true, compartir: true }
                };
                req.lista = lista;
                return next();
            }

            // Verificar acceso directo a lista compartida
            const [listaCompartida] = await db.execute(
                `SELECT rol FROM lista_compartida 
                 WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                [idLista, idUsuario]
            );

            if (listaCompartida.length > 0) {
                const rol = listaCompartida[0].rol;
                const permisos = obtenerPermisosPorRol(rol);

                if (permisos[accion]) {
                    req.permisos = {
                        esCreador: false,
                        esPropietario: false,
                        rol,
                        puede: permisos,
                        esCompartida: true,
                        tipoAcceso: 'lista_compartida'
                    };
                    req.lista = lista;
                    return next();
                }

                return res.status(403).json({
                    success: false,
                    error: `Tu rol de "${rol}" no permite ${accion} esta lista`
                });
            }

            // Verificar acceso heredado de categoría compartida
            if (lista.idCategoria) {
                const [categoriaCompartida] = await db.execute(
                    `SELECT rol FROM categoria_compartida 
                     WHERE idCategoria = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
                    [lista.idCategoria, idUsuario]
                );

                if (categoriaCompartida.length > 0) {
                    const rol = categoriaCompartida[0].rol;
                    const permisos = obtenerPermisosPorRol(rol);

                    if (permisos[accion]) {
                        req.permisos = {
                            esCreador: false,
                            esPropietario: false,
                            rol,
                            puede: permisos,
                            esCompartida: true,
                            tipoAcceso: 'categoria_compartida',
                            heredadoDeCategoria: true
                        };
                        req.lista = lista;
                        return next();
                    }

                    return res.status(403).json({
                        success: false,
                        error: `Tu rol de "${rol}" en la categoría no permite ${accion} esta lista`
                    });
                }
            }

            // No tiene acceso
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a esta lista'
            });
        } catch (error) {
            console.error('Error en verificarPermisoLista:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al verificar permisos'
            });
        }
    };
};
/**
 * Verifica permisos sobre una tarea (propias o compartidas, con herencia)
 * @param {string} accion - 'ver', 'editar', 'eliminar', 'mover'
 */
const verificarPermisoTarea = (accion) => {
    return async (req, res, next) => {
        try {
            const { id } = req.params;
            const idUsuario = req.usuario.idUsuario;

            console.log(`🔐 Verificando permiso "${accion}" para tarea ${id}, usuario ${idUsuario}`);

            // 1️⃣ Obtener información de la tarea
            const [tareaRows] = await db.execute(
                `SELECT t.*, l.idUsuario as idPropietarioLista
         FROM tarea t
         LEFT JOIN lista l ON t.idLista = l.idLista
         WHERE t.idTarea = ?`,
                [id]
            );

            if (tareaRows.length === 0) {
                console.log('❌ Tarea no encontrada');
                return res.status(404).json({
                    success: false,
                    message: 'Tarea no encontrada'
                });
            }

            const tarea = tareaRows[0];
            console.log('📋 Tarea encontrada:', {
                idTarea: tarea.idTarea,
                idUsuarioTarea: tarea.idUsuario,
                idLista: tarea.idLista,
                idPropietarioLista: tarea.idPropietarioLista
            });

            // 2️⃣ Verificar si es el propietario de la tarea
            if (tarea.idUsuario === idUsuario) {
                console.log('✅ Es propietario de la tarea');
                return next();
            }

            // 3️⃣ Si la tarea no está en una lista, solo el propietario puede editarla
            if (!tarea.idLista) {
                console.log('❌ Tarea sin lista y usuario no es propietario');
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para realizar esta acción',
                    detalles: 'Solo el propietario puede modificar tareas sin lista'
                });
            }

            // 4️⃣ Verificar si es propietario de la lista
            if (tarea.idPropietarioLista === idUsuario) {
                console.log('✅ Es propietario de la lista');
                return next();
            }

            // 5️⃣ Verificar permisos compartidos
            const [permisosRows] = await db.execute(
                `SELECT lc.rol, lc.esCreador, lc.activo, lc.aceptado
         FROM lista_compartida lc
         WHERE lc.idLista = ? AND lc.idUsuario = ? AND lc.activo = TRUE AND lc.aceptado = TRUE`,
                [tarea.idLista, idUsuario]
            );

            if (permisosRows.length === 0) {
                console.log('❌ Usuario sin permisos compartidos en la lista');
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para realizar esta acción',
                    detalles: 'No tienes acceso a esta lista compartida'
                });
            }

            const permisoCompartido = permisosRows[0];
            const rol = permisoCompartido.rol;

            console.log('🔍 Rol del usuario en lista compartida:', rol);

            // 6️⃣ Validar permisos según la acción
            const permisosValidos = {
                ver: ['admin', 'editor', 'colaborador', 'visor'],
                editar: ['admin', 'editor', 'colaborador'],
                eliminar: ['admin', 'editor'],
                crear: ['admin', 'editor', 'colaborador']
            };

            if (!permisosValidos[accion]) {
                console.log('❌ Acción no válida:', accion);
                return res.status(400).json({
                    success: false,
                    message: 'Acción no válida'
                });
            }

            if (permisosValidos[accion].includes(rol)) {
                console.log(`✅ Rol "${rol}" tiene permiso para "${accion}"`);
                return next();
            }

            console.log(`❌ Rol "${rol}" NO tiene permiso para "${accion}"`);
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar esta acción',
                detalles: `Tu rol "${rol}" no permite ${accion} tareas`
            });

        } catch (error) {
            console.error('❌ Error en verificarPermisoTarea:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos',
                error: error.message
            });
        }
    };
};

/**
 * Obtiene los permisos según el rol
 * @param {string} rol - 'admin', 'colaborador', 'lector'
 * @returns {Object} Objeto con permisos booleanos
 */

const obtenerPermisosPorRol = (rol) => {
    const permisos = {
        propietario: {
            ver: true,
            editar: true,
            eliminar: true,
            mover: true,
            compartir: true
        },
        admin: {
            ver: true,
            editar: true,
            eliminar: true,
            mover: true,
            compartir: true
        },
        editor: {  // ✅ NUEVO ROL
            ver: true,
            editar: true,
            eliminar: true,
            mover: true,
            compartir: false
        },
        colaborador: {
            ver: true,
            editar: true,
            eliminar: false,
            mover: false,
            compartir: false
        },
        lector: {
            ver: true,
            editar: false,
            eliminar: false,
            mover: false,
            compartir: false
        },
        visor: {  // ✅ Alias para lector
            ver: true,
            editar: false,
            eliminar: false,
            mover: false,
            compartir: false
        }
    };

    return permisos[rol] || permisos.lector;
};

/**
 * Verifica si el usuario tiene acceso a una categoría (lectura mínima)
 */
const tieneAccesoCategoria = async (req, res, next) => {
    try {
        const { idCategoria } = req.params;
        const idUsuario = req.usuario.idUsuario;

        const [rows] = await db.execute(
            `SELECT c.idUsuario, cc.rol 
             FROM categoria c
             LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                AND cc.idUsuario = ? AND cc.activo = TRUE AND cc.aceptado = TRUE
             WHERE c.idCategoria = ?`,
            [idUsuario, idCategoria]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Categoría no encontrada'
            });
        }

        const esCreador = rows[0].idUsuario === idUsuario;
        const tieneAccesoCompartido = rows[0].rol !== null;

        if (esCreador || tieneAccesoCompartido) {
            req.permisos = {
                esCreador,
                esPropietario: esCreador,
                rol: esCreador ? 'propietario' : rows[0].rol,
                puede: obtenerPermisosPorRol(esCreador ? 'propietario' : rows[0].rol)
            };
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'No tienes acceso a esta categoría'
        });
    } catch (error) {
        console.error('Error en tieneAccesoCategoria:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al verificar acceso'
        });
    }
};

/**
 * Verifica si el usuario tiene acceso a una lista (lectura mínima)
 */
const tieneAccesoLista = async (req, res, next) => {
    try {
        const { idLista } = req.params;
        const idUsuario = req.usuario.idUsuario;

        const [rows] = await db.execute(
            `SELECT l.idUsuario, lc.rol 
             FROM lista l
             LEFT JOIN lista_compartida lc ON l.idLista = lc.idLista 
                AND lc.idUsuario = ? AND lc.activo = TRUE AND lc.aceptado = TRUE
             WHERE l.idLista = ?`,
            [idUsuario, idLista]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Lista no encontrada'
            });
        }

        const esCreador = rows[0].idUsuario === idUsuario;
        const tieneAccesoCompartido = rows[0].rol !== null;

        if (esCreador || tieneAccesoCompartido) {
            req.permisos = {
                esCreador,
                esPropietario: esCreador,
                rol: esCreador ? 'propietario' : rows[0].rol,
                puede: obtenerPermisosPorRol(esCreador ? 'propietario' : rows[0].rol)
            };
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'No tienes acceso a esta lista'
        });
    } catch (error) {
        console.error('Error en tieneAccesoLista:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al verificar acceso'
        });
    }
};


const puedeCrearTareaEnLista = async (req, res, next) => {
    try {
        const { idLista } = req.body;
        const idUsuario = req.usuario.idUsuario;

        // Si no hay lista, puede crear tarea personal
        if (!idLista) {
            console.log('✅ Creando tarea personal (sin lista)');
            return next();
        }

        console.log(`🔐 Verificando permiso para crear tarea en lista ${idLista}`);

        // 1️⃣ Verificar si es propietario de la lista
        const [listaRows] = await db.execute(
            'SELECT idUsuario FROM lista WHERE idLista = ?',
            [idLista]
        );

        if (listaRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lista no encontrada'
            });
        }

        if (listaRows[0].idUsuario === idUsuario) {
            console.log('✅ Es propietario de la lista');
            return next();
        }

        // 2️⃣ Verificar permisos compartidos
        const [permisosRows] = await db.execute(
            `SELECT rol FROM lista_compartida 
       WHERE idLista = ? AND idUsuario = ? AND activo = TRUE AND aceptado = TRUE`,
            [idLista, idUsuario]
        );

        if (permisosRows.length === 0) {
            console.log('❌ Usuario sin permisos en la lista');
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para crear tareas en esta lista'
            });
        }

        const rol = permisosRows[0].rol;
        console.log('🔍 Rol del usuario:', rol);

        // 3️⃣ Validar rol (admin, editor, colaborador pueden crear)
        if (['admin', 'editor', 'colaborador'].includes(rol)) {
            console.log(`✅ Rol "${rol}" puede crear tareas`);
            return next();
        }

        console.log(`❌ Rol "${rol}" NO puede crear tareas`);
        return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear tareas en esta lista',
            detalles: `Tu rol "${rol}" es de solo lectura`
        });

    } catch (error) {
        console.error('❌ Error en puedeCrearTareaEnLista:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar permisos',
            error: error.message
        });
    }
};

module.exports = {
    esAdminCategoria,
    esAdminLista,
    verificarPermisoCategoria,
    verificarPermisoLista,
    verificarPermisoTarea,
    obtenerPermisosPorRol,
    tieneAccesoCategoria,
    tieneAccesoLista,
    puedeCrearTareaEnLista
};