const pool = require('../config/config');

/**
 * Middleware: Verificar que el email del usuario esté verificado
 * Usar en rutas que requieran verificación de email
 */
const requerirEmailVerificado = async (req, res, next) => {
    try {
        const idUsuario = req.usuario.idUsuario;

        // Consultar estado de verificación
        const [rows] = await pool.query(
            'SELECT emailVerificado FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        if (!rows[0].emailVerificado) {
            return res.status(403).json({
                error: 'Email no verificado',
                message: 'Debes verificar tu email antes de acceder a esta función',
                requiereVerificacion: true
            });
        }

        // Email verificado, continuar
        next();

    } catch (error) {
        console.error('❌ Error en middleware de verificación:', error);
        res.status(500).json({
            error: 'Error al verificar estado de email'
        });
    }
};

/**
 * Middleware: Verificar que el email NO esté verificado
 * Usar en endpoints de verificación para evitar re-verificaciones
 */
const requerirEmailNoVerificado = async (req, res, next) => {
    try {
        const idUsuario = req.body.idUsuario || req.params.idUsuario;

        if (!idUsuario) {
            return res.status(400).json({
                error: 'ID de usuario no proporcionado'
            });
        }

        const [rows] = await pool.query(
            'SELECT emailVerificado FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        if (rows[0].emailVerificado) {
            return res.status(400).json({
                error: 'Email ya verificado',
                message: 'Tu email ya ha sido verificado previamente'
            });
        }

        // Email no verificado, continuar
        next();

    } catch (error) {
        console.error('❌ Error en middleware de verificación:', error);
        res.status(500).json({
            error: 'Error al verificar estado de email'
        });
    }
};

module.exports = {
    requerirEmailVerificado,
    requerirEmailNoVerificado
};