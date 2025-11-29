const Nota = require('../models/notas');

const notaController = {
    // GET /api/notas
    async obtenerNotas(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario; // Del middleware de autenticación
            const notas = await Nota.obtenerPorUsuario(idUsuario);
            res.json({ success: true, data: notas });
        } catch (error) {
            console.error('Error al obtener notas:', error);
            res.status(500).json({ success: false, message: 'Error al obtener notas' });
        }
    },

    // POST /api/notas
    async crearNota(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario;
            const { titulo, contenido, color } = req.body;

            const idNota = await Nota.crear({
                titulo,
                contenido,
                color,
                idUsuario
            });

            const notas = await Nota.obtenerPorUsuario(idUsuario);
            const notaCreada = notas.find(n => n.idNota === idNota);

            res.status(201).json({
                success: true,
                message: 'Nota creada exitosamente',
                data: notaCreada
            });
        } catch (error) {
            console.error('Error al crear nota:', error);
            res.status(500).json({ success: false, message: 'Error al crear nota' });
        }
    },

    // PUT /api/notas/:id
    async actualizarNota(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario;
            const idNota = parseInt(req.params.id);
            const datos = req.body;

            const actualizado = await Nota.actualizar(idNota, idUsuario, datos);

            if (!actualizado) {
                return res.status(404).json({
                    success: false,
                    message: 'Nota no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Nota actualizada exitosamente'
            });
        } catch (error) {
            console.error('Error al actualizar nota:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar nota' });
        }
    },

    // DELETE /api/notas/:id
    async eliminarNota(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario;
            const idNota = parseInt(req.params.id);

            const eliminado = await Nota.eliminar(idNota, idUsuario);

            if (!eliminado) {
                return res.status(404).json({
                    success: false,
                    message: 'Nota no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Nota eliminada exitosamente'
            });
        } catch (error) {
            console.error('Error al eliminar nota:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar nota' });
        }
    },

    // POST /api/notas/:id/duplicar
    async duplicarNota(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario;
            const idNota = parseInt(req.params.id);

            const idNotaNueva = await Nota.duplicar(idNota, idUsuario);

            if (!idNotaNueva) {
                return res.status(404).json({
                    success: false,
                    message: 'Nota no encontrada'
                });
            }

            const notas = await Nota.obtenerPorUsuario(idUsuario);
            const notaDuplicada = notas.find(n => n.idNota === idNotaNueva);

            res.status(201).json({
                success: true,
                message: 'Nota duplicada exitosamente',
                data: notaDuplicada
            });
        } catch (error) {
            console.error('Error al duplicar nota:', error);
            res.status(500).json({ success: false, message: 'Error al duplicar nota' });
        }
    },

    // PUT /api/notas/posiciones
    async actualizarPosiciones(req, res) {
        try {
            const idUsuario = req.usuario.idUsuario;
            const { notas } = req.body;

            await Nota.actualizarPosiciones(notas, idUsuario);

            res.json({
                success: true,
                message: 'Posiciones actualizadas exitosamente'
            });
        } catch (error) {
            console.error('Error al actualizar posiciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar posiciones'
            });
        }
    }
};

module.exports = notaController;