const resend = require('../config/resend.config');
const fs = require('fs').promises;
const path = require('path');
const { obtenerFrontendUrl } = require('../utils/urlHelper');

class EmailService {

  async cargarTemplate(nombreTemplate) {
    try {
      const templatePath = path.join(__dirname, '../template/email', nombreTemplate);
      console.log('🔍 Buscando template en:', templatePath);
      const html = await fs.readFile(templatePath, 'utf-8');
      return html;
    } catch (error) {
      console.error(`❌ Error al cargar template ${nombreTemplate}:`, error);
      throw new Error(`No se pudo cargar el template: ${nombreTemplate}`);
    }
  }

  reemplazarPlaceholders(html, datos) {
    let resultado = html;

    Object.keys(datos).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      resultado = resultado.replace(regex, datos[key]);
    });

    return resultado;
  }

  // Método helper para modo de prueba
  obtenerEmailDestino(email) {
    // Si estamos en modo desarrollo/prueba y el email no es el de prueba autorizado
    // redirigir al email de prueba pero loggearlo
    const emailPrueba = process.env.RESEND_TEST_EMAIL; 
    const usarModoPrueba = process.env.RESEND_TEST_MODE === 'true';

    if (usarModoPrueba && emailPrueba) {
      if (email !== emailPrueba) {
        console.log(`⚠️ MODO PRUEBA: Email original: ${email}, enviando a: ${emailPrueba}`);
        return emailPrueba;
      }
    }

    return email;
  }

  async enviarCodigoVerificacion(email, nombre, codigo) {
    try {
      const emailDestino = this.obtenerEmailDestino(email);
      
      let html = await this.cargarTemplate('verificacion.html');

      html = this.reemplazarPlaceholders(html, {
        NOMBRE: nombre,
        CODIGO: codigo,
        ANIO: new Date().getFullYear(),
        FRONTEND_URL: obtenerFrontendUrl()
      });

      const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: [emailDestino],
        subject: '🔐 Verifica tu cuenta en Taskeer',
        html: html,
        text: `Hola ${nombre},\n\nTu código de verificación es: ${codigo}\n\nEste código expira en 15 minutos.\n\n¡Gracias por unirte a Taskeer!`
      });

      if (error) {
        console.error('❌ Error de Resend:', error);
        throw error;
      }

      console.log('✅ Email de verificación enviado:', data.id);
      console.log('📧 Destinatario original:', email);
      console.log('📧 Destinatario real:', emailDestino);

      return {
        success: true,
        messageId: data.id,
        destinatario: email
      };
    } catch (error) {
      console.error('❌ Error al enviar email de verificación:', error);
      throw new Error('No se pudo enviar el email de verificación');
    }
  }

  async enviarBienvenida(email, nombre) {
    try {
      const emailDestino = this.obtenerEmailDestino(email);
      
      let html = await this.cargarTemplate('bienvenida.html');

      html = this.reemplazarPlaceholders(html, {
        NOMBRE: nombre,
        EMAIL: email,
        ANIO: new Date().getFullYear(),
        FRONTEND_URL: obtenerFrontendUrl()
      });

      const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: [emailDestino],
        subject: '🎉 ¡Bienvenido a Taskeer!',
        html: html,
        text: `¡Hola ${nombre}!\n\nTu cuenta ha sido verificada exitosamente.\n\n¡Bienvenido a Taskeer!`
      });

      if (error) {
        console.error('❌ Error de Resend:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Email de bienvenida enviado:', data.id);

      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('❌ Error al enviar email de bienvenida:', error);
      return { success: false, error: error.message };
    }
  }

  async testConexion() {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY no configurada');
      }
      
      console.log('✅ Conexión con Resend exitosa');
      return { success: true, message: 'Resend API conectada' };
    } catch (error) {
      console.error('❌ Error al conectar con Resend:', error);
      return { success: false, error: error.message };
    }
  }

  async enviarCodigoCambioPassword(email, nombre, codigo) {
    try {
      const emailDestino = this.obtenerEmailDestino(email);
      
      let html = await this.cargarTemplate('cambio-password.html');

      html = this.reemplazarPlaceholders(html, {
        NOMBRE: nombre,
        CODIGO: codigo,
        ANIO: new Date().getFullYear(),
        FRONTEND_URL: obtenerFrontendUrl()
      });

      const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: [emailDestino],
        subject: '🔑 Código para Cambio de Contraseña - Taskeer',
        html: html,
        text: `Hola ${nombre},\n\nTu código para cambiar la contraseña es: ${codigo}\n\nEste código expira en 15 minutos.\n\nSi no solicitaste este cambio, ignora este mensaje.`
      });

      if (error) {
        console.error('❌ Error de Resend:', error);
        throw error;
      }

      console.log('✅ Email de cambio de contraseña enviado:', data.id);
      console.log('📧 Destinatario:', emailDestino);

      return {
        success: true,
        messageId: data.id,
        destinatario: email
      };
    } catch (error) {
      console.error('❌ Error al enviar email de cambio de contraseña:', error);
      throw new Error('No se pudo enviar el email de cambio de contraseña');
    }
  }

  async enviarCodigoRecuperacionPassword(email, nombre, codigo) {
    try {
      const emailDestino = this.obtenerEmailDestino(email);
      
      let html = await this.cargarTemplate('recuperacion-password.html');

      html = this.reemplazarPlaceholders(html, {
        NOMBRE: nombre,
        CODIGO: codigo,
        ANIO: new Date().getFullYear(),
        FRONTEND_URL: obtenerFrontendUrl()
      });

      const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: [emailDestino],
        subject: '🔓 Código de Recuperación de Contraseña - Taskeer',
        html: html,
        text: `Hola ${nombre},\n\nTu código de recuperación de contraseña es: ${codigo}\n\nEste código expira en 15 minutos.\n\nSi no solicitaste este cambio, ignora este mensaje.`
      });

      if (error) {
        console.error('❌ Error de Resend:', error);
        throw error;
      }

      console.log('✅ Email de recuperación enviado:', data.id);
      console.log('📧 Destinatario:', emailDestino);

      return {
        success: true,
        messageId: data.id,
        destinatario: email
      };
    } catch (error) {
      console.error('❌ Error al enviar email de recuperación:', error);
      throw new Error('No se pudo enviar el email de recuperación');
    }
  }
}

module.exports = new EmailService();