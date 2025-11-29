class SSEManager {
    constructor() {
        // Map<idUsuario, Set<Response>>
        this.clients = new Map();

        // Heartbeat cada 30 segundos para mantener conexiones activas
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 30000);

        console.log('📡 SSE Manager inicializado');
    }

    /**
     * Agregar cliente al manager
     */
    addClient(idUsuario, response) {
        if (!this.clients.has(idUsuario)) {
            this.clients.set(idUsuario, new Set());
        }

        this.clients.get(idUsuario).add(response);
        console.log(`✅ Cliente agregado - Usuario ${idUsuario} (Total: ${this.clients.get(idUsuario).size} conexiones)`);
    }

    /**
     * Remover cliente del manager
     */
    removeClient(idUsuario, response) {
        const userClients = this.clients.get(idUsuario);
        if (userClients) {
            userClients.delete(response);

            if (userClients.size === 0) {
                this.clients.delete(idUsuario);
            }

            console.log(`❌ Cliente removido - Usuario ${idUsuario} (Restantes: ${userClients.size})`);
        }
    }

    /**
     * Enviar notificación a un usuario específico
     */
    sendToUser(idUsuario, data) {
        const userClients = this.clients.get(idUsuario);

        if (!userClients || userClients.size === 0) {
            console.log(`⚠️ No hay clientes SSE conectados para usuario ${idUsuario}`);
            return false;
        }

        const event = this.formatSSE(data);
        
        //  Si formatSSE devuelve vacío, no enviar
        if (!event) {
            console.error(' Evento SSE vacío, no se envía');
            return false;
        }

        let sentCount = 0;
        const deadClients = [];

        for (const client of userClients) {
            try {
                client.write(event);
                sentCount++;
            } catch (error) {
                console.error(`❌ Error al enviar a cliente de usuario ${idUsuario}:`, error.message);
                deadClients.push(client);
            }
        }

        // Limpiar conexiones muertas
        deadClients.forEach(client => this.removeClient(idUsuario, client));

        // LOG DETALLADO DE ENVÍO SSE
        if (sentCount > 0) {
            console.log(`📡 ===== SSE ENVIADO =====`);
            console.log(`   👤 Usuario: ${idUsuario}`);
            console.log(`   🎯 Tipo: ${data.tipo || data.event || 'sin_tipo'}`);
            console.log(`   📋 Título: ${data.titulo || 'sin_titulo'}`);
            console.log(`   ✅ Clientes alcanzados: ${sentCount}/${userClients.size}`);
            console.log(`   🕐 Timestamp: ${new Date().toISOString()}`);
            console.log(`========================`);
        }

        return sentCount > 0;
    }

    /**
     * Enviar notificación a múltiples usuarios
     */
    sendToUsers(userIds, data) {
        let totalSent = 0;

        for (const userId of userIds) {
            if (this.sendToUser(userId, data)) {
                totalSent++;
            }
        }

        return totalSent;
    }

    /**
     * Broadcast a todos los usuarios conectados
     */
    broadcast(data) {
        const event = this.formatSSE(data);
        
        if (!event) {
            console.error('❌ Evento SSE vacío, no se hace broadcast');
            return 0;
        }

        let totalClients = 0;

        for (const [userId, clients] of this.clients.entries()) {
            for (const client of clients) {
                try {
                    client.write(event);
                    totalClients++;
                } catch (error) {
                    console.error(` Error en broadcast para usuario ${userId}:`, error.message);
                }
            }
        }

        console.log(` Broadcast enviado a ${totalClients} clientes`);
        return totalClients;
    }

    /**
     * Formatear datos al formato SSE
     *  MEJORADO: Validación exhaustiva
     */
    formatSSE(data) {
        try {
            //  Validar que data existe
            if (!data) {
                console.error(' formatSSE: data es undefined o null');
                return '';
            }

            //  Validar que data es un objeto
            if (typeof data !== 'object') {
                console.error('❌ formatSSE: data no es un objeto:', typeof data);
                return '';
            }

            //  Determinar el evento (por defecto 'nueva_notificacion')
            const event = data.event || 'nueva_notificacion';

            //  Determinar el ID
            const id = data.id || data.idNotificacion || Date.now();

            //  Remover campo 'event' del payload para evitar duplicación
            const { event: _, ...cleanData } = data;

            // Validar que cleanData tiene contenido
            if (!cleanData || Object.keys(cleanData).length === 0) {
                console.error('❌ formatSSE: cleanData está vacío después de limpiar');
                console.error('   Data original:', data);
                return '';
            }

            // CRÍTICO: Asegurar que idNotificacion existe en cleanData
            if (!cleanData.idNotificacion && !cleanData.id) {
                cleanData.idNotificacion = id;
                cleanData.id = id;
            }

            //  Convertir a string JSON
            let payload;
            try {
                payload = JSON.stringify(cleanData);
            } catch (jsonError) {
                console.error('❌ formatSSE: Error al convertir a JSON:', jsonError.message);
                console.error('   cleanData:', cleanData);
                return '';
            }

            //  Validar que el payload no esté vacío
            if (!payload || payload === '{}') {
                console.error('❌ formatSSE: payload vacío o inválido');
                return '';
            }

            //  Formato SSE estándar
            const sseMessage = `id: ${id}\nevent: ${event}\ndata: ${payload}\n\n`;

            console.log(`📡 Formateando SSE:`);
            console.log(`   Evento: ${event}`);
            console.log(`   ID: ${id}`);
            console.log(`   Payload size: ${payload.length} chars`);
            console.log(`   Tiene idNotificacion: ${!!cleanData.idNotificacion}`);
            console.log(`   Tipo: ${cleanData.tipo || 'N/A'}`);

            return sseMessage;

        } catch (error) {
            console.error('❌ formatSSE: Error inesperado:', error.message);
            console.error('Stack:', error.stack);
            return '';
        }
    }

    /**
     * Enviar heartbeat para mantener conexiones activas
     */
    sendHeartbeat() {
        const heartbeat = `: heartbeat ${new Date().toISOString()}\n\n`;
        let aliveConnections = 0;

        for (const [userId, clients] of this.clients.entries()) {
            const deadClients = [];

            for (const client of clients) {
                try {
                    client.write(heartbeat);
                    aliveConnections++;
                } catch (error) {
                    deadClients.push(client);
                }
            }

            deadClients.forEach(client => this.removeClient(userId, client));
        }

        if (aliveConnections > 0) {
            console.log(`💓 Heartbeat enviado a ${aliveConnections} conexiones`);
        }
    }

    /**
     * Obtener estadísticas del manager
     */
    getStats() {
        let totalConnections = 0;
        for (const clients of this.clients.values()) {
            totalConnections += clients.size;
        }

        return {
            totalUsers: this.clients.size,
            totalConnections,
            users: Array.from(this.clients.keys())
        };
    }

    /**
     * Verificar si un usuario está conectado
     */
    isUserConnected(idUsuario) {
        return this.clients.has(idUsuario) && this.clients.get(idUsuario).size > 0;
    }

    /**
     * Limpiar todas las conexiones (shutdown)
     */
    cleanup() {
        clearInterval(this.heartbeatInterval);

        for (const [userId, clients] of this.clients.entries()) {
            for (const client of clients) {
                try {
                    client.end();
                } catch (error) {
                    console.error(`Error al cerrar cliente de usuario ${userId}:`, error.message);
                }
            }
        }

        this.clients.clear();
        console.log('🧹 SSE Manager limpiado');
    }
}

// Exportar instancia única (Singleton)
module.exports = new SSEManager();