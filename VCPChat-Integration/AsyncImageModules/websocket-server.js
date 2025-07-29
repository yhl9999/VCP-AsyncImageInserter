/**
 * AsyncImage WebSocket集成
 * 集成到VCPToolBox的统一WebSocket服务器中
 */

class AsyncImageWebSocketIntegration {
    constructor() {
        this.wsServer = null;
        this.monitoringProcesses = new Map();
        this.asyncImageClients = new Set();
    }

    /**
     * 初始化 - 集成到现有WebSocket服务器
     * @param {WebSocketServer} webSocketServer - VCPToolBox的WebSocket服务器实例
     */
    initialize(webSocketServer) {
        this.wsServer = webSocketServer;
        
        // 添加AsyncImage的路径处理
        this.registerAsyncImagePath();
        
        console.log('[AsyncImageWS] 已集成到VCPToolBox WebSocket服务器');
    }

    /**
     * 注册AsyncImage的WebSocket路径
     */
    registerAsyncImagePath() {
        // 这里我们需要修改VCPToolBox的WebSocketServer.js
        // 添加对 /vcp-async-image/VCP_Key=xxx 路径的支持
        
        console.log('[AsyncImageWS] AsyncImage WebSocket路径已注册');
    }

    /**
     * 处理AsyncImage客户端连接
     * @param {WebSocket} ws - WebSocket连接
     */
    handleAsyncImageClient(ws) {
        const clientId = this.generateClientId();
        ws.clientId = clientId;
        ws.clientType = 'AsyncImage';
        
        this.asyncImageClients.add(ws);
        
        console.log(`[AsyncImageWS] AsyncImage客户端 ${clientId} 已连接`);
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleClientMessage(ws, data);
            } catch (error) {
                console.error('[AsyncImageWS] 消息解析失败:', error);
            }
        });

        ws.on('close', () => {
            this.asyncImageClients.delete(ws);
            console.log(`[AsyncImageWS] AsyncImage客户端 ${clientId} 已断开`);
        });

        // 发送连接确认
        ws.send(JSON.stringify({
            type: 'connection_ack', 
            message: 'AsyncImage WebSocket连接成功'
        }));
    }

    /**
     * 处理客户端消息
     * @param {WebSocket} ws - WebSocket连接
     * @param {Object} data - 消息数据
     */
    handleClientMessage(ws, data) {
        const { type, payload } = data;

        switch (type) {
            case 'subscribe_task':
                this.subscribeToTask(payload.taskId, payload.placeholder);
                break;
            case 'unsubscribe_task':
                this.unsubscribeFromTask(payload.taskId);
                break;
            case 'get_task_status':
                this.sendTaskStatus(ws, payload.taskId);
                break;
            default:
                console.warn('[AsyncImageWS] 未知消息类型:', type);
        }
    }

    /**
     * 订阅任务更新
     * @param {string} taskId - 任务ID
     * @param {string} placeholder - 占位符
     */
    subscribeToTask(taskId, placeholder) {
        if (this.monitoringProcesses.has(taskId)) {
            return; // 已经在监控
        }

        console.log('[AsyncImageWS] 开始监控任务:', taskId);
        this.startTaskMonitoring(taskId, placeholder);
    }

    /**
     * 开始任务监控
     * @param {string} taskId - 任务ID
     * @param {string} placeholder - 占位符
     */
    startTaskMonitoring(taskId, placeholder) {
        const monitorProcess = setInterval(async () => {
            try {
                const status = await this.checkTaskStatus(taskId);
                
                if (status) {
                    this.broadcastUpdate({
                        type: 'async_image_update',
                        taskId,
                        placeholder,
                        status: status.status,
                        imageUrl: status.imageUrl,
                        error: status.error
                    });

                    if (status.status === 'completed' || status.status === 'failed') {
                        this.stopTaskMonitoring(taskId);
                    }
                }
            } catch (error) {
                console.error('[AsyncImageWS] 任务监控错误:', error);
            }
        }, 2000);

        this.monitoringProcesses.set(taskId, monitorProcess);

        // 5分钟后超时停止监控
        setTimeout(() => {
            this.stopTaskMonitoring(taskId);
        }, 5 * 60 * 1000);
    }

    /**
     * 停止任务监控
     * @param {string} taskId - 任务ID
     */
    stopTaskMonitoring(taskId) {
        const process = this.monitoringProcesses.get(taskId);
        if (process) {
            clearInterval(process);
            this.monitoringProcesses.delete(taskId);
            console.log('[AsyncImageWS] 停止监控任务:', taskId);
        }
    }

    /**
     * 检查任务状态
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object|null>} 任务状态
     */
    async checkTaskStatus(taskId) {
        // TODO: 集成到VCPToolBox的插件系统
        // 通过PluginManager查询AsyncImageInserter插件的任务状态
        
        // 临时实现：模拟状态检查
        const random = Math.random();
        if (random < 0.1) {
            return {
                status: 'completed',
                imageUrl: `http://localhost:6005/pw=123456/images/async/${taskId}.png`,
                completedAt: Date.now()
            };
        } else if (random < 0.02) {
            return {
                status: 'failed',
                error: '图片生成失败',
                failedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * 广播更新到所有AsyncImage客户端
     * @param {Object} updateData - 更新数据
     */
    broadcastUpdate(updateData) {
        const message = JSON.stringify(updateData);
        
        this.asyncImageClients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });

        console.log('[AsyncImageWS] 广播更新:', updateData);
    }

    /**
     * 发送任务状态到特定客户端
     * @param {WebSocket} ws - WebSocket连接
     * @param {string} taskId - 任务ID
     */
    async sendTaskStatus(ws, taskId) {
        try {
            const status = await this.checkTaskStatus(taskId);
            ws.send(JSON.stringify({
                type: 'task_status_response',
                taskId,
                status
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'task_status_error',
                taskId,
                error: error.message
            }));
        }
    }

    /**
     * 生成客户端ID
     * @returns {string} 客户端ID
     */
    generateClientId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 停止所有监控进程
        this.monitoringProcesses.forEach((process, taskId) => {
            clearInterval(process);
        });
        this.monitoringProcesses.clear();

        // 清理客户端连接
        this.asyncImageClients.clear();

        console.log('[AsyncImageWS] AsyncImage WebSocket集成已清理');
    }
}

// 全局实例
let asyncImageWS = null;

/**
 * 初始化AsyncImage WebSocket集成
 * @param {WebSocketServer} webSocketServer - VCPToolBox的WebSocket服务器
 */
function initializeAsyncImageWebSocket(webSocketServer) {
    if (!asyncImageWS) {
        asyncImageWS = new AsyncImageWebSocketIntegration();
        asyncImageWS.initialize(webSocketServer);
    }
    return asyncImageWS;
}

module.exports = {
    AsyncImageWebSocketIntegration,
    initializeAsyncImageWebSocket
};