// src/routes/compartir/lista.compartir.routes.js
const express = require('express');
const router = express.Router();
const listaCompartirController = require('../../controllers/compartir/lista-compartir.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const { esAdminLista } = require('../../middlewares/permisosMiddleware');

// Generar clave para compartir lista
router.post(
    '/:idLista/generar-clave',
    authMiddleware,
    esAdminLista,
    listaCompartirController.generarClaveLista
);

// Unirse a lista con clave
router.post(
    '/unirse',
    authMiddleware,
    listaCompartirController.unirseListaPorClave
);

// Invitar usuario por email a lista
router.post(
    '/:idLista/invitar',
    authMiddleware,
    esAdminLista,
    listaCompartirController.invitarUsuarioLista
);

// Listar usuarios con acceso a lista
router.get(
    '/:idLista/usuarios',
    authMiddleware,
    esAdminLista,
    listaCompartirController.listarUsuariosLista
);

// Modificar rol de usuario en lista
router.put(
    '/:idLista/usuario/:idUsuarioModificar/rol',
    authMiddleware,
    /*esAdminLista,*/
    listaCompartirController.modificarRolLista
);

// Revocar acceso a lista
router.delete(
    '/:idLista/usuario/:idUsuarioRevocar',
    authMiddleware,
    esAdminLista,
    listaCompartirController.revocarAccesoLista
);

// Salir de una lista compartida
router.post(
    '/:idLista/salir',
    authMiddleware,
    listaCompartirController.salirDeLista
);

// Descompartir lista (revocar todos los accesos)
router.post(
    '/:idLista/descompartir',
    authMiddleware,
    esAdminLista,
    listaCompartirController.descompartirLista
);

// Obtener todas las listas compartidas del usuario
router.get(
    '/mis-compartidas',
    authMiddleware,
    listaCompartirController.obtenerListasCompartidas
);

// Obtener información de compartidos de una lista específica
router.get(
    '/:idLista/info-compartidos',
    authMiddleware,
    listaCompartirController.infoCompartidosLista
);

module.exports = router;