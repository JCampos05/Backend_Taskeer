// src/routes/compartir/invitacion.routes.js
const express = require('express');
const router = express.Router();
const invitacionController = require('../../controllers/compartir/invitacion.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

// Obtener invitaciones pendientes del usuario
router.get(
    '/pendientes',
    authMiddleware,
    invitacionController.obtenerInvitacionesPendientes
);

// Aceptar invitación
router.post(
    '/:token/aceptar',
    authMiddleware,
    invitacionController.aceptarInvitacion
);

// Rechazar invitación
router.post(
    '/:token/rechazar',
    authMiddleware,
    invitacionController.rechazarInvitacion
);

module.exports = router;