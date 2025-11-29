class Notificacion {
  constructor(data) {
    this.id = data.id;
    this.tipo = data.tipo; // 'invitacion_lista' | 'tarea_asignada' | 'comentario'
    this.titulo = data.titulo;
    this.mensaje = data.mensaje;
    this.leida = data.leida;
    this.fecha = data.fecha;
    this.datos = data.datos ? (typeof data.datos === 'string' ? JSON.parse(data.datos) : data.datos) : null;
  }

  static fromDatabase(row) {
    return new Notificacion({
      id: row.id,
      tipo: row.tipo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      leida: Boolean(row.leida === 1 || row.leida === true),
      fecha: row.fecha,
      datos: row.datos_adicionales
    });
  }

  toJSON() {
    return {
      id: this.id,
      tipo: this.tipo,
      titulo: this.titulo,
      mensaje: this.mensaje,
      leida: this.leida,
      fecha: this.fecha,
      datos: this.datos
    };
  }
}

module.exports = Notificacion;