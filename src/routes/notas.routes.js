const express = require('express');
const router = express.Router();
const notaController = require('../controllers/notas.controller');
const auth = require('../middlewares/authMiddleware'); // Tu middleware de autenticación

// Todas las rutas requieren autenticación
router.use(auth);

router.get('/', notaController.obtenerNotas);
router.post('/', notaController.crearNota);
router.put('/:id', notaController.actualizarNota);
router.delete('/:id', notaController.eliminarNota);
router.post('/:id/duplicar', notaController.duplicarNota);
router.put('/posiciones', notaController.actualizarPosiciones);

module.exports = router;