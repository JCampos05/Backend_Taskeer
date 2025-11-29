const db = require("../config/config"); // Tu conexión a MySQL

class Nota {
    // Obtener todas las notas del usuario
    static async obtenerPorUsuario(idUsuario) {
        const query = `
      SELECT * FROM nota 
      WHERE idUsuario = ? 
      ORDER BY fijada DESC, posicion ASC, fechaActualizacion DESC
    `;
        const [rows] = await db.query(query, [idUsuario]);
        return rows;
    }

    // Crear nota
    static async crear(data) {
        const { titulo, contenido, color, idUsuario } = data;
        const query = `
      INSERT INTO nota (titulo, contenido, color, idUsuario) 
      VALUES (?, ?, ?, ?)
    `;
        const [result] = await db.query(query, [
            titulo || "Sin título",
            contenido || "",
            color || "#BAC0CE",
            idUsuario,
        ]);
        return result.insertId;
    }

    // Actualizar nota
    static async actualizar(idNota, idUsuario, data) {
        const campos = [];
        const valores = [];

        if (data.titulo !== undefined) {
            campos.push("titulo = ?");
            valores.push(data.titulo);
        }
        if (data.contenido !== undefined) {
            campos.push("contenido = ?");
            valores.push(data.contenido);
        }
        if (data.color !== undefined) {
            campos.push("color = ?");
            valores.push(data.color);
        }
        if (data.fijada !== undefined) {
            campos.push("fijada = ?");
            valores.push(data.fijada);
        }
        if (data.posicion !== undefined) {
            campos.push("posicion = ?");
            valores.push(data.posicion);
        }

        if (campos.length === 0) return false;

        valores.push(idNota, idUsuario);
        const query = `
      UPDATE nota 
      SET ${campos.join(", ")} 
      WHERE idNota = ? AND idUsuario = ?
    `;
        const [result] = await db.query(query, valores);
        return result.affectedRows > 0;
    }

    // Eliminar nota
    static async eliminar(idNota, idUsuario) {
        const query = "DELETE FROM nota WHERE idNota = ? AND idUsuario = ?";
        const [result] = await db.query(query, [idNota, idUsuario]);
        return result.affectedRows > 0;
    }

    // Duplicar nota
    static async duplicar(idNota, idUsuario) {
        const querySelect = `
      SELECT titulo, contenido, color 
      FROM nota 
      WHERE idNota = ? AND idUsuario = ?
    `;
        const [rows] = await db.query(querySelect, [idNota, idUsuario]);

        if (rows.length === 0) return null;

        const nota = rows[0];
        const queryInsert = `
      INSERT INTO nota (titulo, contenido, color, idUsuario) 
      VALUES (?, ?, ?, ?)
    `;
        const [result] = await db.query(queryInsert, [
            `${nota.titulo} (copia)`,
            nota.contenido,
            nota.color,
            idUsuario,
        ]);
        return result.insertId;
    }

    // Actualizar posiciones (para drag and drop)
    static async actualizarPosiciones(notasOrdenadas, idUsuario) {
        const promises = notasOrdenadas.map((nota, index) => {
            const query = `
        UPDATE nota 
        SET posicion = ? 
        WHERE idNota = ? AND idUsuario = ?
      `;
            return db.query(query, [index, nota.idNota, idUsuario]);
        });
        await Promise.all(promises);
        return true;
    }
}

module.exports = Nota;
