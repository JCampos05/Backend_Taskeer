const express = require('express');
const router = express.Router();
const estadisticasController = require('../controllers/estadisticas.controller');
const { verificarToken } = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/estadisticas/generales
router.get('/generales', estadisticasController.obtenerEstadisticasGenerales);

// GET /api/estadisticas/productividad/:periodo
router.get('/productividad/:periodo', estadisticasController.obtenerProductividad);

// GET /api/estadisticas/calendario-contribuciones
router.get('/calendario-contribuciones', estadisticasController.obtenerCalendarioContribuciones);

// GET /api/estadisticas/historial-reciente
router.get('/historial-reciente', estadisticasController.obtenerHistorialReciente);

// GET /api/estadisticas/categorias-frecuentes
router.get('/categorias-frecuentes', estadisticasController.obtenerCategoriasFrecuentes);

// GET /api/estadisticas/racha-completacion
router.get('/racha-completacion', estadisticasController.obtenerRachaCompletacion);

module.exports = router;