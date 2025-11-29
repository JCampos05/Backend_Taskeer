// src/routes/compartir.routes.js
const express = require('express');
const router = express.Router();

// Importar las rutas modulares
const categoriaCompartirRoutes = require('./compartir/categoria-compartir.routes');
const listaCompartirRoutes = require('./compartir/lista-compartir.routes');
const invitacionRoutes = require('./compartir/invitacion.routes');
const notificacionRoutes = require('./compartir/notificacion.routes'); // ✅ NUEVO

// Montar las rutas
router.use('/categoria', categoriaCompartirRoutes);
router.use('/lista', listaCompartirRoutes);
router.use('/invitaciones', invitacionRoutes);
router.use('/notificaciones', notificacionRoutes); // ✅ NUEVO

module.exports = router;