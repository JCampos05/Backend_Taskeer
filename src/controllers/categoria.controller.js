// src/controllers/categoria.controller.js
const Categoria = require('../models/categoria');
const db = require('../config/config');

// Obtener todas las categorías del usuario (propias y compartidas)
const obtenerCategorias = async (req, res) => {
    try {
        const idUsuario = req.usuario.idUsuario;

        const query = `
            SELECT DISTINCT
                c.idCategoria,
                c.nombre,
                c.claveCompartir,
                c.tipoPrivacidad,
                c.compartible,
                c.idUsuario,
                c.fechaActualizacion,
                CASE 
                    WHEN c.idUsuario = ? THEN 'admin'
                    ELSE MAX(cc.rol)
                END as rolUsuario,
                (c.idUsuario = ?) as esPropietario,
                COUNT(DISTINCT l.idLista) as cantidadListas
            FROM categoria c
            LEFT JOIN categoria_compartida cc ON c.idCategoria = cc.idCategoria 
                AND cc.idUsuario = ? AND cc.activo = TRUE AND cc.aceptado = TRUE
            LEFT JOIN lista l ON c.idCategoria = l.idCategoria
            WHERE c.idUsuario = ? OR (cc.idUsuario = ? AND cc.activo = TRUE)
            GROUP BY c.idCategoria, c.nombre, c.claveCompartir, 
                     c.tipoPrivacidad, c.compartible, c.idUsuario, c.fechaActualizacion
            ORDER BY c.nombre ASC
        `;

        const [rows] = await db.execute(query, [
            idUsuario, idUsuario, idUsuario, idUsuario, idUsuario
        ]);

        res.json({
            categorias: rows.map(cat => ({
                idCategoria: cat.idCategoria,
                nombre: cat.nombre,
                color: cat.color,
                icono: cat.icono,
                esPropietario: Boolean(cat.esPropietario),
                rol: cat.rolUsuario,
                compartida: !cat.esPropietario,
                cantidadListas: parseInt(cat.cantidadListas) || 0,
                claveCompartir: cat.esPropietario ? cat.claveCompartir : null
            }))
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

// Obtener una categoría por ID (con verificación de permisos)
const obtenerCategoriaPorId = async (req, res) => {
    try {
        const categoria = await Categoria.obtenerPorId(
            req.params.idCategoria,
            req.usuario.idUsuario
        );
        
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada o no tienes acceso'
            });
        }

        res.json({
            success: true,
            data: categoria
        });
    } catch (error) {
        console.error('Error al obtener categoría:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Crear nueva categoría
const crearCategoria = async (req, res) => {
    try {
        const { nombre } = req.body;
        
        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'El nombre es requerido'
            });
        }

        const categoriaData = {
            nombre: nombre.trim(),
            idUsuario: req.usuario.idUsuario
        };

        const nuevaCategoria = await Categoria.crear(categoriaData);
        
        res.status(201).json({
            success: true,
            message: 'Categoría creada exitosamente',
            data: nuevaCategoria
        });
    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Actualizar categoría (con verificación de permisos)
const actualizarCategoria = async (req, res) => {
    try {
        const { idCategoria } = req.params;
        const { nombre } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'El nombre es requerido'
            });
        }

        // Verificar permisos de edición
        const tienePermiso = await Categoria.verificarPermiso(
            idCategoria,
            req.usuario.idUsuario,
            'editar'
        );

        if (!tienePermiso) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar esta categoría'
            });
        }

        const categoriaActualizada = await Categoria.actualizar(
            idCategoria,
            { nombre: nombre.trim() },
            req.usuario.idUsuario
        );

        if (!categoriaActualizada) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Categoría actualizada exitosamente',
            data: categoriaActualizada
        });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Eliminar categoría (solo propietario)
const eliminarCategoria = async (req, res) => {
    try {
        const { idCategoria } = req.params;

        const eliminada = await Categoria.eliminar(
            idCategoria,
            req.usuario.idUsuario
        );

        if (!eliminada) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada o no tienes permisos para eliminarla'
            });
        }

        res.json({
            success: true,
            message: 'Categoría eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Obtener categoría con sus listas (con permisos)
const obtenerCategoriaConListas = async (req, res) => {
    try {
        const { idCategoria } = req.params;

        const categoria = await Categoria.obtenerConListas(
            idCategoria,
            req.usuario.idUsuario
        );

        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada o no tienes acceso'
            });
        }

        res.json({
            success: true,
            data: categoria
        });
    } catch (error) {
        console.error('Error al obtener categoría con listas:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Obtener rol del usuario en la categoría
const obtenerMiRol = async (req, res) => {
    try {
        const { idCategoria } = req.params;
        
        const rolInfo = await Categoria.obtenerRol(
            idCategoria,
            req.usuario.idUsuario
        );

        if (!rolInfo) {
            return res.status(404).json({
                success: false,
                message: 'No tienes acceso a esta categoría'
            });
        }

        res.json({
            success: true,
            data: rolInfo
        });
    } catch (error) {
        console.error('Error al obtener rol:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    obtenerCategorias,
    obtenerCategoriaPorId,
    crearCategoria,
    actualizarCategoria,
    eliminarCategoria,
    obtenerCategoriaConListas,
    obtenerMiRol
};