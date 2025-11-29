const express = require('express');
const router = express.Router();
const listaController = require('../controllers/lista.controller');
const verificarToken = require('../middlewares/authMiddleware').verificarToken;
const { verificarPermisoLista } = require('../middlewares/permisosMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);

// ============================================
// RUTAS DE LISTAS (CON PERMISOS COMPARTIDOS)
// ============================================

// Crear lista (solo usuario autenticado)
router.post('/', listaController.crearLista);

// Obtener todas las listas del usuario (propias y compartidas)
router.get('/', listaController.obtenerListas);

// Rutas específicas sin ID (deben ir antes de /:idLista)
router.get('/sin-categoria', listaController.obtenerSinCategoria);
router.get('/importantes', listaController.obtenerImportantes);

// Obtener listas por categoría
router.get('/categoria/:idCategoria', listaController.obtenerPorCategoria);

// ============================================
// RUTAS CON :idLista (DESPUÉS DE RUTAS ESPECÍFICAS)
// ============================================

// Obtener tareas de una lista (con verificación de permisos)
router.get(
    '/:idLista/tareas',
    verificarPermisoLista('ver'),
    listaController.obtenerConTareas
);

// Obtener estadísticas de una lista
router.get(
    '/:idLista/estadisticas',
    verificarPermisoLista('ver'),
    listaController.obtenerEstadisticas
);

// Obtener una lista específica (con verificación de permisos)
router.get(
    '/:idLista',
    verificarPermisoLista('ver'),
    listaController.obtenerListaPorId
);

// Actualizar lista (requiere permiso de editar)
router.put(
    '/:idLista',
    verificarPermisoLista('editar'),
    listaController.actualizarLista
);

// Eliminar lista (requiere permiso de eliminar)
router.delete(
    '/:idLista',
    verificarPermisoLista('eliminar'),
    listaController.eliminarLista
);

module.exports = router;