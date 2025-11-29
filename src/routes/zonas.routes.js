// src/routes/zonas.routes.js
const express = require('express');
const router = express.Router();
const zonasController = require('../controllers/zonas.controller');
const authMiddleware = require('../middlewares/authMiddleware');

// ✅ Rutas públicas (antes de autenticación)
// Obtener todas las zonas horarias (para selector en login/registro)
router.get('/lista', zonasController.obtenerZonasHorarias);

// Obtener regiones disponibles
router.get('/regiones', zonasController.obtenerRegiones);

// ✅ Rutas protegidas (requieren autenticación)
router.use(authMiddleware.verificarToken);

// Obtener zona horaria del usuario actual
router.get('/usuario', zonasController.obtenerZonaHorariaUsuario);

// Actualizar zona horaria del usuario
router.put('/usuario', zonasController.actualizarZonaHorariaUsuario);

module.exports = router;