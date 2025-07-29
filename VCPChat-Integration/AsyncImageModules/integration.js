/**
 * AsyncImage集成到VCPChat消息渲染
 * 在消息渲染时自动处理[IMG:xxx]格式
 */

const AsyncImageProcessor = require('./async-image-processor');
const PlaceholderReplacer = require('./placeholder-replacer');

class AsyncImageIntegration {
    constructor() {
        this.processor = new AsyncImageProcessor();
        this.replacer = new PlaceholderReplacer();
        this.websocket = null;
        this.isEnabled = true;

        this.initWebSocket();
    }

    /**
     * 初始化WebSocket连接
     */
    initWebSocket() {
        try {
            // 连接到VCPToolBox的统一WebSocket服务器
            // 使用AsyncImage专用路径
            const vcpKey = this.getVCPKey(); // 需要获取VCP_Key
            this.websocket = new WebSocket(`ws://localhost:6005/vcp-async-image/VCP_Key=${vcpKey}`);

            this.websocket.onopen = () => {
                console.log('[AsyncImage] WebSocket连接已建立');
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('[AsyncImage] WebSocket消息解析失败:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('[AsyncImage] WebSocket连接已关闭');
                // 3秒后重连
                setTimeout(() => this.initWebSocket(), 3000);
            };

            this.websocket.onerror = (error) => {
                console.error('[AsyncImage] WebSocket错误:', error);
            };

        } catch (error) {
            console.error('[AsyncImage] WebSocket初始化失败:', error);
        }
    }

    /**
     * 获取VCP_Key配置
     * @returns {string} VCP密钥
     */
    getVCPKey() {
        // TODO: 从VCPChat配置中获取VCP_Key
        // 这个key应该与VCPToolBox中配置的相同
        return '123456'; // 临时硬编码，实际应该从配置读取
    }

    /**
     * 处理WebSocket消息
     * @param {Object} data - 消息数据
     */
    handleWebSocketMessage(data) {
        const { type } = data;

        switch (type) {
            case 'async_image_update':
                this.replacer.handleImageUpdate(data);
                break;
            case 'task_status_response':
                console.log('[AsyncImage] 任务状态:', data);
                break;
            default:
                console.log('[AsyncImage] 未知WebSocket消息:', data);
        }
    }

    /**
     * 处理消息渲染 - 集成到现有的messageRenderer
     * @param {string} content - 消息内容
     * @param {Element} containerElement - 容器元素
     * @returns {Promise<string>} 处理后的内容
     */
    async processMessageContent(content, containerElement) {
        if (!this.isEnabled || !content.includes('[IMG:')) {
            return content;
        }

        try {
            // 预处理消息，提取图片任务
            const { processedMessage, tasks } = this.processor.preprocessMessage(content);

            if (tasks.length > 0) {
                console.log(`[AsyncImage] 检测到 ${tasks.length} 个图片生成任务`);

                // 注册占位符到替换器
                tasks.forEach(task => {
                    this.replacer.registerPlaceholder(task.taskId, task.placeholder, containerElement);
                    
                    // 订阅WebSocket更新
                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                        this.websocket.send(JSON.stringify({
                            type: 'subscribe_task',
                            payload: {
                                taskId: task.taskId,
                                placeholder: task.placeholder
                            }
                        }));
                    }
                });

                // 异步提交任务（不阻塞渲染）
                this.processor.submitAsyncTasks(tasks).catch(error => {
                    console.error('[AsyncImage] 任务提交失败:', error);
                    
                    // 如果提交失败，显示错误状态
                    tasks.forEach(task => {
                        this.replacer.handleImageUpdate({
                            taskId: task.taskId,
                            status: 'failed',
                            error: '任务提交失败',
                            placeholder: task.placeholder
                        });
                    });
                });
            }

            return processedMessage;

        } catch (error) {
            console.error('[AsyncImage] 消息处理失败:', error);
            return content; // 出错时返回原内容
        }
    }

    /**
     * 启用/禁用异步图片功能
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[AsyncImage] 功能${enabled ? '启用' : '禁用'}`);
    }

    /**
     * 获取系统状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            websocketConnected: this.websocket && this.websocket.readyState === WebSocket.OPEN,
            activePlaceholders: this.replacer.getStatus(),
            taskQueue: this.processor.taskQueue.size
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.websocket) {
            this.websocket.close();
        }
        
        this.replacer.cleanup();
    }
}

// 创建全局实例
window.asyncImageIntegration = new AsyncImageIntegration();

// 导出模块
module.exports = AsyncImageIntegration;