// src/controllers/compartir/invitacion.controller.js
const db = require('../../config/config');
const NotificacionController = require('./notificacion.controller');

class InvitacionController {

  // Invitar usuario a lista
  async invitarUsuarioLista(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const idLista = req.params.id;
      const { email, rol } = req.body;
      const idUsuarioInvita = req.usuario.idUsuario;
      
      // Verificar que el usuario que invita tenga permisos
      const [permisos] = await connection.query(
        `SELECT rol FROM lista_compartida 
         WHERE idLista = ? AND idUsuario = ?
         UNION
         SELECT 'propietario' as rol FROM lista 
         WHERE idLista = ? AND idUsuario = ?`,
        [idLista, idUsuarioInvita, idLista, idUsuarioInvita]
      );
      
      if (permisos.length === 0 || (permisos[0].rol !== 'propietario' && permisos[0].rol !== 'admin')) {
        await connection.rollback();
        return res.status(403).json({ error: 'No tienes permisos para invitar usuarios' });
      }
      
      // Buscar el usuario por email
      const [usuarios] = await connection.query(
        'SELECT idUsuario, nombre, email FROM usuario WHERE email = ?',
        [email]
      );
      
      if (usuarios.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Usuario no encontrado con ese email' });
      }
      
      const usuarioInvitado = usuarios[0];
      
      // Verificar si ya está en la lista
      const [yaCompartida] = await connection.query(
        'SELECT * FROM lista_compartida WHERE idLista = ? AND idUsuario = ?',
        [idLista, usuarioInvitado.idUsuario]
      );
      
      if (yaCompartida.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'El usuario ya tiene acceso a esta lista' });
      }
      
      // Obtener información de la lista
      const [listas] = await connection.query(
        'SELECT nombre FROM lista WHERE idLista = ?',
        [idLista]
      );
      
      // Obtener nombre del usuario que invita
      const [usuarioInvitador] = await connection.query(
        'SELECT nombre FROM usuario WHERE idUsuario = ?',
        [idUsuarioInvita]
      );
      
      // Crear notificación
      await NotificacionController.crearNotificacion(
        connection,
        usuarioInvitado.idUsuario,
        'invitacion_lista',
        `${usuarioInvitador[0].nombre} te invitó a una lista`,
        `Has sido invitado a colaborar en la lista "${listas[0].nombre}" como ${rol}`,
        {
          listaId: parseInt(idLista),
          listaNombre: listas[0].nombre,
          invitadoPor: usuarioInvitador[0].nombre,
          invitadoPorId: idUsuarioInvita,
          rol: rol
        }
      );
      
      await connection.commit();
      
      res.json({ 
        success: true, 
        mensaje: `Invitación enviada a ${email}`,
        usuario: {
          id: usuarioInvitado.idUsuario,
          nombre: usuarioInvitado.nombre,
          email: usuarioInvitado.email
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error al invitar usuario:', error);
      res.status(500).json({ error: 'Error al enviar invitación' });
    } finally {
      connection.release();
    }
  }

  // Obtener invitaciones pendientes
  async obtenerInvitacionesPendientes(req, res) {
    try {
      const idUsuario = req.usuario.idUsuario;
      
      const [invitaciones] = await db.execute(
        `SELECT id as idNotificacion,
                id_usuario as idUsuario,
                tipo,
                titulo,
                mensaje,
                datos_adicionales as datos,
                leida,
                fecha_creacion as fechaCreacion
         FROM notificaciones 
         WHERE id_usuario = ? AND tipo = 'invitacion_lista' AND leida = FALSE
         ORDER BY fecha_creacion DESC`,
        [idUsuario]
      );
      
      res.json({
        invitaciones: invitaciones.map(inv => ({
          ...inv,
          datos: inv.datos ? JSON.parse(inv.datos) : null
        }))
      });
    } catch (error) {
      console.error('Error al obtener invitaciones:', error);
      res.status(500).json({ error: 'Error al obtener invitaciones' });
    }
  }

  // Aceptar invitación
  async aceptarInvitacion(req, res) {
    return NotificacionController.aceptarInvitacion(req, res);
  }

  // Rechazar invitación
  async rechazarInvitacion(req, res) {
    return NotificacionController.rechazarInvitacion(req, res);
  }
}

module.exports = new InvitacionController();