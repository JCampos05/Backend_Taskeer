// src/routes/compartir/categoria.compartir.routes.js
const express = require('express');
const router = express.Router();
const categoriaCompartirController = require('../../controllers/compartir/categoria-compartir.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const { esAdminCategoria } = require('../../middlewares/permisosMiddleware');

// Generar clave para compartir categoría
router.post(
    '/:idCategoria/generar-clave',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.generarClaveCategoria
);

// Unirse a categoría con clave
router.post(
    '/unirse',
    authMiddleware,
    categoriaCompartirController.unirseCategoriaPorClave
);

// Invitar usuario por email a categoría
router.post(
    '/:idCategoria/invitar',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.invitarUsuarioCategoria
);

// Listar usuarios con acceso a categoría
router.get(
    '/:idCategoria/usuarios',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.listarUsuariosCategoria
);

// Modificar rol de usuario en categoría
router.put(
    '/:idCategoria/usuario/:idUsuarioModificar/rol',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.modificarRolCategoria
);

// Revocar acceso a categoría
router.delete(
    '/:idCategoria/usuario/:idUsuarioRevocar',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.revocarAccesoCategoria
);

// Salir de una categoría compartida
router.post(
    '/:idCategoria/salir',
    authMiddleware,
    categoriaCompartirController.salirDeCategoria
);

// Descompartir categoría (revocar todos los accesos)
router.post(
    '/:idCategoria/descompartir',
    authMiddleware,
    esAdminCategoria,
    categoriaCompartirController.descompartirCategoria
);

// Obtener todas las categorías compartidas del usuario
router.get(
    '/mis-compartidas',
    authMiddleware,
    categoriaCompartirController.obtenerCategoriasCompartidas
);

// Obtener información de compartidos de una categoría específica
router.get(
    '/:idCategoria/info-compartidos',
    authMiddleware,
    categoriaCompartirController.infoCompartidosCategoria
);

module.exports = router;