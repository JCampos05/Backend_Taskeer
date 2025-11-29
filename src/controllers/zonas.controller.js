// src/controllers/zonas.controller.js
const db = require('../config/config');

/**
 * Obtener todas las zonas horarias disponibles
 */
exports.obtenerZonasHorarias = async (req, res) => {
    try {
        const { region } = req.query;

        let query = `
            SELECT 
                idZona,
                zona,
                nombre,
                region,
                offset_actual,
                offset_minutos,
                usa_dst
            FROM zonas_horarias
            WHERE activa = TRUE
        `;

        const params = [];

        if (region) {
            query += ' AND region = ?';
            params.push(region);
        }

        query += ' ORDER BY orden, nombre';

        const [zonas] = await db.execute(query, params);

        res.json({
            success: true,
            total: zonas.length,
            zonas
        });

    } catch (error) {
        console.error('❌ Error al obtener zonas horarias:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener zonas horarias',
            detalle: error.message
        });
    }
};

/**
 * Obtener regiones disponibles
 */
exports.obtenerRegiones = async (req, res) => {
    try {
        const [regiones] = await db.execute(`
            SELECT DISTINCT region, COUNT(*) as total_zonas
            FROM zonas_horarias
            WHERE activa = TRUE
            GROUP BY region
            ORDER BY MIN(orden)
        `);

        res.json({
            success: true,
            total: regiones.length,
            regiones
        });

    } catch (error) {
        console.error('❌ Error al obtener regiones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener regiones',
            detalle: error.message
        });
    }
};

/**
 * Actualizar zona horaria del usuario
 */
exports.actualizarZonaHorariaUsuario = async (req, res) => {
    try {
        const { zonaHoraria } = req.body;
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        if (!zonaHoraria) {
            return res.status(400).json({
                success: false,
                error: 'Zona horaria es requerida'
            });
        }

        // Validar que la zona horaria existe
        const [zonas] = await db.execute(
            'SELECT idZona FROM zonas_horarias WHERE zona = ? AND activa = TRUE',
            [zonaHoraria]
        );

        if (zonas.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Zona horaria inválida'
            });
        }

        // Actualizar usuario
        await db.execute(
            'UPDATE usuario SET zona_horaria = ? WHERE idUsuario = ?',
            [zonaHoraria, idUsuario]
        );

        console.log(`✅ Zona horaria actualizada para usuario ${idUsuario}: ${zonaHoraria}`);

        res.json({
            success: true,
            mensaje: 'Zona horaria actualizada exitosamente',
            zonaHoraria
        });

    } catch (error) {
        console.error('❌ Error al actualizar zona horaria:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar zona horaria',
            detalle: error.message
        });
    }
};

/**
 * Obtener zona horaria del usuario actual
 */
exports.obtenerZonaHorariaUsuario = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario || req.usuario.id;

        const [usuarios] = await db.execute(
            'SELECT zona_horaria FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            zonaHoraria: usuarios[0].zona_horaria
        });

    } catch (error) {
        console.error('❌ Error al obtener zona horaria:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener zona horaria',
            detalle: error.message
        });
    }
};

module.exports = exports;