const connection = require('../config/config');

// Obtener estadísticas generales
const obtenerEstadisticasGenerales = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;

        // Total de tareas (tabla singular: tarea)
        const [totalResult] = await connection.query(
            'SELECT COUNT(*) as total FROM tarea WHERE idUsuario = ?',
            [idUsuario]
        );
        const totalTareas = totalResult[0].total;

        // Tareas por estado
        const [estadosResult] = await connection.query(
            `SELECT 
                estado,
                COUNT(*) as cantidad
            FROM tarea
            WHERE idUsuario = ?
            GROUP BY estado`,
            [idUsuario]
        );

        const porEstado = {
            P: 0,
            N: 0,
            C: 0
        };
        estadosResult.forEach(row => {
            porEstado[row.estado] = row.cantidad;
        });

        // Tareas vencidas
        const [vencidasResult] = await connection.query(
            `SELECT COUNT(*) as vencidas
            FROM tarea
            WHERE idUsuario = ?
            AND fechaVencimiento < CURDATE()
            AND estado != 'C'`,
            [idUsuario]
        );
        const tareasVencidas = vencidasResult[0].vencidas;

        // Tiempo promedio de completación: días desde creación hasta vencimiento
        // Para tareas completadas, asumimos que se completaron cerca del vencimiento
        const [promedioResult] = await connection.query(
            `SELECT AVG(DATEDIFF(COALESCE(fechaVencimiento, CURDATE()), fechaCreacion)) as promedio
            FROM tarea
            WHERE idUsuario = ?
            AND estado = 'C'
            AND fechaVencimiento IS NOT NULL`,
            [idUsuario]
        );
        const tiempoPromedio = promedioResult[0].promedio 
            ? parseFloat(promedioResult[0].promedio).toFixed(1)
            : 0;

        // Calcular racha
        const racha = await calcularRacha(idUsuario);

        // Calcular porcentaje
        const porcentajeCompletadas = totalTareas > 0
            ? parseFloat((porEstado.C / totalTareas * 100).toFixed(2))
            : 0;

        res.json({
            success: true,
            data: {
                totalTareas,
                tareasCompletadas: porEstado.C,
                tareasEnProceso: porEstado.N,
                tareasPendientes: porEstado.P,
                tareasVencidas,
                porcentajeCompletadas,
                rachaActual: racha.rachaActual,
                rachaMaxima: racha.rachaMaxima,
                tiempoPromedioCompletacion: parseFloat(tiempoPromedio)
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas generales:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

// Obtener productividad por período
const obtenerProductividad = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const periodo = req.params.periodo;

        let dias;
        switch (periodo) {
            case 'diaria':
                dias = 7;
                break;
            case 'semanal':
                dias = 28;
                break;
            case 'mensual':
                dias = 180;
                break;
            default:
                dias = 28;
        }

        // Obtener tareas completadas por fecha
        const [completadas] = await connection.query(
            `SELECT 
                DATE(fechaCreacion) as fecha,
                COUNT(*) as cantidad
            FROM tarea
            WHERE idUsuario = ?
            AND estado = 'C'
            AND fechaCreacion >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(fechaCreacion)
            ORDER BY fecha`,
            [idUsuario, dias]
        );

        // Obtener tareas creadas por fecha
        const [creadas] = await connection.query(
            `SELECT 
                DATE(fechaCreacion) as fecha,
                COUNT(*) as cantidad
            FROM tarea
            WHERE idUsuario = ?
            AND fechaCreacion >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(fechaCreacion)
            ORDER BY fecha`,
            [idUsuario, dias]
        );

        // Crear mapa de datos
        const datosMap = new Map();

        // Llenar con días vacíos
        for (let i = dias - 1; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            datosMap.set(fechaStr, { fecha: fechaStr, completadas: 0, creadas: 0 });
        }

        // Agregar completadas
        completadas.forEach(row => {
            const fechaStr = new Date(row.fecha).toISOString().split('T')[0];
            if (datosMap.has(fechaStr)) {
                datosMap.get(fechaStr).completadas = row.cantidad;
            }
        });

        // Agregar creadas
        creadas.forEach(row => {
            const fechaStr = new Date(row.fecha).toISOString().split('T')[0];
            if (datosMap.has(fechaStr)) {
                datosMap.get(fechaStr).creadas = row.cantidad;
            }
        });

        const datos = Array.from(datosMap.values());

        res.json({
            success: true,
            data: {
                periodo,
                datos
            }
        });
    } catch (error) {
        console.error('Error al obtener productividad:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productividad',
            error: error.message
        });
    }
};

// Obtener calendario de contribuciones (tareas completadas por día)
const obtenerCalendarioContribuciones = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const dias = parseInt(req.query.dias) || 365;

        // Usamos fechaCreacion para tareas completadas
        const [result] = await connection.query(
            `SELECT 
                DATE(fechaCreacion) as fecha,
                COUNT(*) as cantidad
            FROM tarea
            WHERE idUsuario = ?
            AND estado = 'C'
            AND fechaCreacion >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(fechaCreacion)
            ORDER BY fecha`,
            [idUsuario, dias]
        );

        // Llenar todos los días con 0
        const contribuciones = [];
        for (let i = dias - 1; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];

            const registro = result.find(r => {
                const rFecha = new Date(r.fecha).toISOString().split('T')[0];
                return rFecha === fechaStr;
            });

            const cantidad = registro ? registro.cantidad : 0;
            const nivel = obtenerNivelContribucion(cantidad);

            contribuciones.push({
                fecha: fechaStr,
                cantidad,
                nivel
            });
        }

        res.json({
            success: true,
            data: contribuciones
        });
    } catch (error) {
        console.error('Error al obtener calendario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener calendario de contribuciones',
            error: error.message
        });
    }
};

// Obtener historial reciente
const obtenerHistorialReciente = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const limite = parseInt(req.query.limite) || 10;

        const [result] = await connection.query(
            `SELECT 
                t.idTarea,
                t.nombre,
                t.estado,
                t.fechaCreacion,
                l.nombre as nombreLista,
                l.color as colorLista,
                CASE 
                    WHEN t.estado = 'C' AND DATE(t.fechaCreacion) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
                        THEN 'completada'
                    WHEN DATE(t.fechaCreacion) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
                        THEN 'creada'
                    ELSE 'modificada'
                END as accion,
                t.fechaCreacion as fecha
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            WHERE t.idUsuario = ?
            ORDER BY fecha DESC
            LIMIT ?`,
            [idUsuario, limite]
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial reciente',
            error: error.message
        });
    }
};

// Obtener categorías más frecuentes
const obtenerCategoriasFrecuentes = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const limite = parseInt(req.query.limite) || 5;

        const [totalResult] = await connection.query(
            'SELECT COUNT(*) as total FROM tarea WHERE idUsuario = ?',
            [idUsuario]
        );
        const totalTareas = totalResult[0].total;

        if (totalTareas === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        const [result] = await connection.query(
            `SELECT 
                COALESCE(c.nombre, 'Sin categoría') as nombreCategoria,
                COUNT(t.idTarea) as cantidad,
                (COUNT(t.idTarea) * 100.0 / ?) as porcentaje
            FROM tarea t
            LEFT JOIN lista l ON t.idLista = l.idLista
            LEFT JOIN categoria c ON l.idCategoria = c.idCategoria
            WHERE t.idUsuario = ?
            GROUP BY c.nombre
            ORDER BY cantidad DESC
            LIMIT ?`,
            [totalTareas, idUsuario, limite]
        );

        const datos = result.map(row => ({
            nombreCategoria: row.nombreCategoria,
            cantidad: row.cantidad,
            porcentaje: parseFloat(row.porcentaje)
        }));

        res.json({
            success: true,
            data: datos
        });
    } catch (error) {
        console.error('Error al obtener categorías frecuentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener categorías frecuentes',
            error: error.message
        });
    }
};

// Obtener racha de completación
const obtenerRachaCompletacion = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;
        const racha = await calcularRacha(idUsuario);

        res.json({
            success: true,
            data: racha
        });
    } catch (error) {
        console.error('Error al obtener racha:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener racha de completación',
            error: error.message
        });
    }
};

// FUNCIONES AUXILIARES

async function calcularRacha(idUsuario) {
    try {
        const [fechas] = await connection.query(
            `SELECT DISTINCT DATE(fechaCreacion) as fecha
            FROM tarea
            WHERE idUsuario = ?
            AND estado = 'C'
            AND fechaCreacion >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
            ORDER BY fecha DESC`,
            [idUsuario]
        );

        if (fechas.length === 0) {
            return { rachaActual: 0, rachaMaxima: 0 };
        }

        let rachaActual = 0;
        let rachaMaxima = 0;
        let rachaTemp = 0;
        let fechaEsperada = new Date();
        fechaEsperada.setHours(0, 0, 0, 0);

        for (const row of fechas) {
            const fecha = new Date(row.fecha);
            fecha.setHours(0, 0, 0, 0);

            const diffDias = Math.floor((fechaEsperada - fecha) / (1000 * 60 * 60 * 24));

            if (diffDias === 0 || diffDias === 1) {
                rachaTemp++;
                if (rachaActual === 0 || diffDias === 0) {
                    rachaActual = rachaTemp;
                }
                rachaMaxima = Math.max(rachaMaxima, rachaTemp);
            } else {
                rachaTemp = 1;
            }

            fechaEsperada = new Date(fecha);
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const ultimaFecha = new Date(fechas[0].fecha);
        ultimaFecha.setHours(0, 0, 0, 0);
        const diffUltima = Math.floor((hoy - ultimaFecha) / (1000 * 60 * 60 * 24));

        if (diffUltima > 1) {
            rachaActual = 0;
        }

        return {
            rachaActual,
            rachaMaxima
        };
    } catch (error) {
        console.error('Error al calcular racha:', error);
        return { rachaActual: 0, rachaMaxima: 0 };
    }
}

function obtenerNivelContribucion(cantidad) {
    if (cantidad === 0) return 0;
    if (cantidad <= 2) return 1;
    if (cantidad <= 4) return 2;
    if (cantidad <= 6) return 3;
    return 4;
}

module.exports = {
    obtenerEstadisticasGenerales,
    obtenerProductividad,
    obtenerCalendarioContribuciones,
    obtenerHistorialReciente,
    obtenerCategoriasFrecuentes,
    obtenerRachaCompletacion
};