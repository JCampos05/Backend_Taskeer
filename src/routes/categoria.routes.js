// src/routes/categoria.routes.js
const express = require('express');
const router = express.Router();

const categoriaController = require('../controllers/categoria.controller');
const { verificarPermisoCategoria } = require('../middlewares/permisosMiddleware');

// ============================================
// RUTAS DE CATEGORÍAS (CON PERMISOS COMPARTIDOS)
// ============================================

// IMPORTANTE: Las rutas sin parámetro deben ir primero
// Obtener todas las categorías del usuario (propias y compartidas)
router.get('/', categoriaController.obtenerCategorias);

// Crear categoría (solo usuario autenticado)
router.post('/', categoriaController.crearCategoria);

// RUTAS CON PARÁMETRO :idCategoria (van después)

// Obtener categoría con sus listas (requiere permiso 'ver')
router.get(
    '/:idCategoria/listas',
    verificarPermisoCategoria('ver'),
    categoriaController.obtenerCategoriaConListas
);

// Obtener rol del usuario en la categoría
router.get(
    '/:idCategoria/mi-rol',
    verificarPermisoCategoria('ver'),
    categoriaController.obtenerMiRol
);

// Obtener una categoría específica (requiere permiso 'ver')
router.get(
    '/:idCategoria',
    verificarPermisoCategoria('ver'),
    categoriaController.obtenerCategoriaPorId
);

// Actualizar categoría (requiere permiso 'editar')
router.put(
    '/:idCategoria',
    verificarPermisoCategoria('editar'),
    categoriaController.actualizarCategoria
);

// Eliminar categoría (requiere permiso 'eliminar')
router.delete(
    '/:idCategoria',
    verificarPermisoCategoria('eliminar'),
    categoriaController.eliminarCategoria
);

module.exports = router;