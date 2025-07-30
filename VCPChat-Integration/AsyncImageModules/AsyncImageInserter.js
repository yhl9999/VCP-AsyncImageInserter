/**
 * AsyncImageInserter - 异步图片插入器主文件
 * 基于Agent协作的异步图片生成系统
 */

const fs = require('fs');
const path = require('path');
const PlaceholderManager = require('./placeholderManager');
const AgentProxy = require('./agentProxy');

class AsyncImageInserter {
    constructor() {
        this.config = this.loadConfig();
        this.placeholderManager = new PlaceholderManager({
            prefix: this.config.PLACEHOLDER_PREFIX
        });
        this.agentProxy = new AgentProxy({
            agentId: this.config.IMAGE_GENERATOR_AGENT_ID,
            timeout: this.config.TASK_TIMEOUT,
            debugMode: this.config.DEBUG_MODE === 'true'
        });
        
        // 任务队列管理
        this.taskQueue = [];
        this.processingTasks = new Set();
        this.maxConcurrentTasks = parseInt(this.config.MAX_CONCURRENT_TASKS) || 3;
        
        // 启动任务处理器
        this.startTaskProcessor();
        
        if (this.config.DEBUG_MODE === 'true') {
            console.error('[AsyncImageInserter] 插件初始化完成');
            console.error('[AsyncImageInserter] 配置:', this.config);
        }
    }

    /**
     * 加载配置文件
     * @returns {Object} 配置对象
     */
    loadConfig() {
        const configPath = path.join(__dirname, 'config.env');
        const config = {};

        try {
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                configContent.split('\\n').forEach(line => {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        const [key, value] = line.split('=');
                        if (key && value !== undefined) {
                            config[key.trim()] = value.trim();
                        }
                    }
                });
            }
        } catch (error) {
            console.error('[AsyncImageInserter] 配置文件加载失败:', error);
        }

        // 设置默认值
        return {
            IMAGE_GENERATOR_AGENT_ID: 'image-generator',
            DEFAULT_IMAGE_SERVICE: 'ComfyUI',
            PLACEHOLDER_PREFIX: 'ASYNC_IMG',
            MAX_CONCURRENT_TASKS: '3',
            TASK_TIMEOUT: '300000',
            DEBUG_MODE: 'false',
            ...config
        };
    }

    /**
     * 处理插件调用请求
     * @param {Object} params - 调用参数
     * @returns {Object} 响应结果
     */
    async processRequest(params) {
        try {
            const { prompt, service, width, height, priority, ...otherOptions } = params;

            // 验证必需参数
            if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
                return {
                    status: "error",
                    error: 'prompt参数是必需的，且不能为空'
                };
            }

            // 构建任务数据
            const taskData = {
                prompt: prompt.trim(),
                service: service || this.config.DEFAULT_IMAGE_SERVICE,
                options: {
                    width: width ? parseInt(width) : undefined,
                    height: height ? parseInt(height) : undefined,
                    ...otherOptions
                },
                priority: priority || 'normal'
            };

            // 创建占位符
            const placeholderInfo = this.placeholderManager.createPlaceholder(taskData);

            // 添加任务到队列
            this.addTaskToQueue({
                ...placeholderInfo,
                taskData
            });

            if (this.config.DEBUG_MODE === 'true') {
                console.error('[AsyncImageInserter] 任务已创建:', placeholderInfo.id);
                console.error('[AsyncImageInserter] 占位符:', placeholderInfo.placeholder);
            }

            // 立即返回占位符给主Agent
            return {
                status: "success",
                result: placeholderInfo.placeholder
            };

        } catch (error) {
            console.error('[AsyncImageInserter] 请求处理失败:', error);
            return {
                status: "error",
                error: `请求处理失败: ${error.message}`
            };
        }
    }

    /**
     * 添加任务到队列
     * @param {Object} task - 任务对象
     */
    addTaskToQueue(task) {
        // 按优先级插入队列
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const taskPriority = priorityOrder[task.priority] || 1;

        let insertIndex = this.taskQueue.length;
        for (let i = 0; i < this.taskQueue.length; i++) {
            const queueTaskPriority = priorityOrder[this.taskQueue[i].priority] || 1;
            if (taskPriority < queueTaskPriority) {
                insertIndex = i;
                break;
            }
        }

        this.taskQueue.splice(insertIndex, 0, task);

        if (this.config.DEBUG_MODE === 'true') {
            console.error(`[AsyncImageInserter] 任务加入队列，位置: ${insertIndex}, 队列长度: ${this.taskQueue.length}`);
        }
    }

    /**
     * 启动任务处理器
     */
    startTaskProcessor() {
        setInterval(() => {
            this.processTaskQueue();
        }, 1000); // 每秒检查一次队列

        // 定期清理过期占位符
        setInterval(() => {
            this.placeholderManager.cleanupExpiredPlaceholders();
        }, 60 * 60 * 1000); // 每小时清理一次
    }

    /**
     * 处理任务队列
     */
    async processTaskQueue() {
        // 检查是否可以处理更多任务
        if (this.processingTasks.size >= this.maxConcurrentTasks || this.taskQueue.length === 0) {
            return;
        }

        // 取出队列中的任务
        const task = this.taskQueue.shift();
        this.processingTasks.add(task.id);

        // 更新占位符状态为处理中
        this.placeholderManager.updatePlaceholderStatus(task.id, 'processing');

        if (this.config.DEBUG_MODE === 'true') {
            console.error(`[AsyncImageInserter] 开始处理任务: ${task.id}`);
        }

        // 异步处理任务
        this.processTask(task).finally(() => {
            this.processingTasks.delete(task.id);
        });
    }

    /**
     * 处理单个任务
     * @param {Object} task - 任务对象
     */
    async processTask(task) {
        try {
            // 调用Agent生成图片
            const result = await this.agentProxy.callImageGenerationAgent({
                prompt: task.prompt,
                service: task.service,
                options: task.options
            });

            // 更新占位符状态为完成
            this.placeholderManager.updatePlaceholderStatus(task.id, 'completed', {
                imageUrl: result.imageUrl,
                allImageUrls: result.allImageUrls,
                generatedAt: new Date().toISOString()
            });

            // 通知前端替换占位符
            await this.notifyPlaceholderReplacement(task, result);

            if (this.config.DEBUG_MODE === 'true') {
                console.error(`[AsyncImageInserter] 任务完成: ${task.id}`);
                console.error(`[AsyncImageInserter] 图片URL: ${result.imageUrl}`);
            }

        } catch (error) {
            console.error(`[AsyncImageInserter] 任务处理失败: ${task.id}`, error);

            // 更新占位符状态为失败
            this.placeholderManager.updatePlaceholderStatus(task.id, 'failed', {
                error: error.message,
                failedAt: new Date().toISOString()
            });

            // 通知前端显示错误
            await this.notifyPlaceholderError(task, error);
        }
    }

    /**
     * 通知前端替换占位符
     * @param {Object} task - 任务对象
     * @param {Object} result - 生成结果
     */
    async notifyPlaceholderReplacement(task, result) {
        // 构建图片HTML
        const imageHtml = `<img src="${result.imageUrl}" alt="${task.prompt}" width="300" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 5px;">`;

        const updateData = {
            type: 'placeholder_replace',
            placeholderId: task.id,
            placeholder: task.placeholder,
            imageUrl: result.imageUrl,
            imageHtml: imageHtml,
            success: true
        };

        // 这里需要实现与VCPChat前端的通信
        // 可以通过WebSocket、IPC或其他方式
        await this.sendUpdateNotification(updateData);
    }

    /**
     * 通知前端显示错误
     * @param {Object} task - 任务对象  
     * @param {Error} error - 错误对象
     */
    async notifyPlaceholderError(task, error) {
        const errorHtml = `<div style="color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 8px; border-radius: 4px; font-size: 12px;">⚠️ 图片生成失败: ${error.message}</div>`;

        const updateData = {
            type: 'placeholder_replace',
            placeholderId: task.id,
            placeholder: task.placeholder,
            imageHtml: errorHtml,
            success: false,
            error: error.message
        };

        await this.sendUpdateNotification(updateData);
    }

    /**
     * 发送更新通知 (待实现与VCPChat的通信机制)
     * @param {Object} updateData - 更新数据
     */
    async sendUpdateNotification(updateData) {
        // TODO: 实现与VCPChat前端的通信
        // 可能的方案：
        // 1. WebSocket推送
        // 2. IPC消息  
        // 3. 文件系统监听
        // 4. HTTP回调

        if (this.config.DEBUG_MODE === 'true') {
            console.error('[AsyncImageInserter] 发送更新通知:', updateData);
        }

        // 临时实现：输出到控制台
        console.error('[AsyncImageInserter] PLACEHOLDER_UPDATE:', JSON.stringify(updateData));
    }

    /**
     * 获取任务状态
     * @param {string} taskId - 任务ID
     * @returns {Object} 任务状态
     */
    getTaskStatus(taskId) {
        const placeholderInfo = this.placeholderManager.getPlaceholderInfo(taskId);
        if (!placeholderInfo) {
            return { error: '任务不存在' };
        }

        return {
            id: placeholderInfo.id,
            status: placeholderInfo.status,
            placeholder: placeholderInfo.placeholder,
            createdAt: placeholderInfo.createdAt,
            updatedAt: placeholderInfo.updatedAt,
            imageUrl: placeholderInfo.imageUrl,
            error: placeholderInfo.error
        };
    }

    /**
     * 获取系统状态
     * @returns {Object} 系统状态
     */
    getSystemStatus() {
        const stats = this.placeholderManager.getStats();
        return {
            ...stats,
            queueLength: this.taskQueue.length,
            processingTasks: this.processingTasks.size,
            maxConcurrentTasks: this.maxConcurrentTasks
        };
    }
}

// 插件入口点
async function main() {
    const inserter = new AsyncImageInserter();

    // 监听stdin输入
    let inputBuffer = '';
    
    process.stdin.on('data', async (data) => {
        console.error('[AsyncImageInserter] 收到数据:', data.toString().trim());
        inputBuffer += data.toString();
        
        // 处理完整的JSON输入
        const lines = inputBuffer.split('\\n');
        inputBuffer = lines.pop() || ''; // 保留不完整的行
        
        console.error('[AsyncImageInserter] 分割后的行数:', lines.length);

        for (const line of lines) {
            if (line.trim()) {
                console.error('[AsyncImageInserter] 处理行:', line.trim());
                try {
                    const request = JSON.parse(line.trim());
                    console.error('[AsyncImageInserter] 解析请求:', request);
                    const response = await inserter.processRequest(request);
                    console.log(JSON.stringify(response));
                } catch (error) {
                    console.error('[AsyncImageInserter] 处理错误:', error);
                    console.log(JSON.stringify({
                        status: "error",
                        error: `请求处理错误: ${error.message}`
                    }));
                }
            }
        }
    });

    process.stdin.on('end', async () => {
        console.error('[AsyncImageInserter] 输入流结束，剩余缓冲:', inputBuffer.trim());
        
        // 处理剩余的输入
        if (inputBuffer.trim()) {
            try {
                const request = JSON.parse(inputBuffer.trim());
                console.error('[AsyncImageInserter] 处理剩余请求:', request);
                const response = await inserter.processRequest(request);
                console.log(JSON.stringify(response));
            } catch (error) {
                console.error('[AsyncImageInserter] 剩余数据处理错误:', error);
                console.log(JSON.stringify({
                    status: "error",
                    error: `请求处理错误: ${error.message}`
                }));
            }
        }
        
        if (inserter.config.DEBUG_MODE === 'true') {
            console.error('[AsyncImageInserter] 输入流处理完成');
        }
        process.exit(0);
    });

    // 错误处理
    process.on('uncaughtException', (error) => {
        console.error('[AsyncImageInserter] 未捕获的异常:', error);
        console.log(JSON.stringify({
            status: "error",
            error: `系统错误: ${error.message}`
        }));
    });

    if (inserter.config.DEBUG_MODE === 'true') {
        console.error('[AsyncImageInserter] 插件启动完成，等待输入...');
    }
    
    // 添加启动确认
    console.error('[AsyncImageInserter] 插件已启动，监听stdin输入');
}

// 启动插件
if (require.main === module) {
    main().catch(error => {
        console.error('[AsyncImageInserter] 启动失败:', error);
        process.exit(1);
    });
}

module.exports = AsyncImageInserter;