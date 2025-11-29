const express = require('express');
const router = express.Router();
const tareaController = require('../controllers/tarea.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const { verificarPermisoTarea, puedeCrearTareaEnLista } = require('../middlewares/permisosMiddleware');

//  RUTAS ESPECÍFICAS PRIMERO (antes de las rutas con parámetros)
router.get('/filtros/vencidas', authMiddleware, tareaController.obtenerVencidas);
router.get('/filtros/mi-dia', authMiddleware, tareaController.obtenerMiDia);
router.get('/estado/:estado', authMiddleware, tareaController.obtenerPorEstado);
router.get('/prioridad/:prioridad', authMiddleware, tareaController.obtenerPorPrioridad);

//  Ruta de usuarios disponibles (ANTES de /lista/:idLista)
router.get('/lista/:idLista/usuarios-disponibles', authMiddleware, tareaController.obtenerUsuariosDisponibles);

//  Ruta de tareas por lista
router.get('/lista/:idLista', authMiddleware, tareaController.obtenerPorLista);

//  Rutas de asignación
router.post('/:id/asignar', authMiddleware, tareaController.asignarTarea);
router.delete('/:id/asignar', authMiddleware, tareaController.desasignarTarea);

//  Rutas PATCH
router.patch('/:id/estado', authMiddleware, tareaController.cambiarEstado);
router.patch('/:id/mi-dia', authMiddleware, tareaController.alternarMiDia);

//  CRUD básico
router.post('/', authMiddleware, puedeCrearTareaEnLista, tareaController.crearTarea);
router.get('/', authMiddleware, tareaController.obtenerTareas);
router.get('/:id', authMiddleware, tareaController.obtenerTareaPorId);
router.put('/:id', authMiddleware, tareaController.actualizarTarea);
router.delete('/:id', authMiddleware, tareaController.eliminarTarea);

//  Ruta de usuarios disponibles (ANTES de /lista/:idLista)
router.get('/lista/:idLista/usuarios-disponibles', authMiddleware, tareaController.obtenerUsuariosDisponibles);

//  NUEVA: Ruta para obtener TODAS las tareas de una lista
router.get('/lista/:idLista/todas', authMiddleware, tareaController.obtenerTodasPorLista);

//  Ruta de tareas por lista
router.get('/lista/:idLista', authMiddleware, tareaController.obtenerPorLista);

//  NUEVO: Ruta para verificar tareas repetidas (cron job manual)
router.post('/verificar-repetidas', authMiddleware, tareaController.verificarTareasRepetidas);

// ========== RECORDATORIOS ==========

// Obtener recordatorios de una tarea
router.get('/:idTarea/recordatorios', tareaController.obtenerRecordatorios);

// Agregar recordatorio a una tarea
router.post('/:idTarea/recordatorios', tareaController.agregarRecordatorio);

// Eliminar recordatorio específico (por índice)
router.delete('/:idTarea/recordatorios/:indice', tareaController.eliminarRecordatorio);

module.exports = router;