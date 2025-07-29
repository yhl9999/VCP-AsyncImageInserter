/**
 * AsyncImage消息预处理器
 * 识别[IMG:xxx]格式并转换为异步占位符
 */

class AsyncImageProcessor {
    constructor() {
        this.taskQueue = new Map();
        this.placeholderPattern = /\[IMG:([^\]]+)\]/g;
    }

    /**
     * 预处理消息，提取图片生成任务
     * @param {string} message - 原始消息
     * @returns {Object} {processedMessage, tasks}
     */
    preprocessMessage(message) {
        const tasks = [];
        let processedMessage = message;

        // 替换所有[IMG:xxx]格式
        processedMessage = message.replace(this.placeholderPattern, (match, content) => {
            const task = this.parseImageTask(content);
            const taskId = this.generateTaskId();
            const placeholder = `[ASYNC_IMG_${taskId}]`;

            tasks.push({
                taskId,
                placeholder,
                prompt: task.prompt,
                service: task.service || 'ComfyUI',
                options: task.options,
                status: 'queued',
                createdAt: Date.now()
            });

            return placeholder;
        });

        return { processedMessage, tasks };
    }

    /**
     * 解析图片任务参数
     * @param {string} content - [IMG:xxx]内的内容
     * @returns {Object} 解析后的任务参数
     */
    parseImageTask(content) {
        // 支持格式：
        // [IMG:雪山日出]
        // [IMG:雪山日出,service=ComfyUI]
        // [IMG:雪山日出,service=NovelAI,width=1024,height=1024]
        
        const parts = content.split(',');
        const prompt = parts[0].trim();
        const options = {};
        let service = 'ComfyUI';

        // 解析参数
        for (let i = 1; i < parts.length; i++) {
            const param = parts[i].trim();
            const [key, value] = param.split('=');
            
            if (key === 'service') {
                service = value;
            } else if (['width', 'height'].includes(key)) {
                options[key] = parseInt(value);
            } else {
                options[key] = value;
            }
        }

        return { prompt, service, options };
    }

    /**
     * 生成唯一任务ID
     * @returns {string} 任务ID
     */
    generateTaskId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `${timestamp}_${random}`;
    }

    /**
     * 提交异步图片生成任务
     * @param {Array} tasks - 任务列表
     */
    async submitAsyncTasks(tasks) {
        if (tasks.length === 0) return;

        try {
            // 调用AsyncImageInserter插件
            const results = await Promise.all(
                tasks.map(task => this.callAsyncImageInserter(task))
            );

            // 存储任务状态
            tasks.forEach((task, index) => {
                this.taskQueue.set(task.taskId, {
                    ...task,
                    status: results[index].success ? 'processing' : 'failed',
                    pluginResponse: results[index]
                });
            });

            return results;
        } catch (error) {
            console.error('[AsyncImageProcessor] 任务提交失败:', error);
            throw error;
        }
    }

    /**
     * 调用AsyncImageInserter插件
     * @param {Object} task - 图片生成任务
     * @returns {Promise<Object>} 插件响应
     */
    async callAsyncImageInserter(task) {
        const { spawn } = require('child_process');
        const path = require('path');

        return new Promise((resolve, reject) => {
            const pluginPath = path.join(__dirname, '..', '..', 'VCPToolBox', 'Plugin', 'AsyncImageInserter', 'AsyncImageInserter.js');
            const pluginProcess = spawn('node', [pluginPath]);

            let responseData = '';
            let errorData = '';

            pluginProcess.stdout.on('data', (data) => {
                responseData += data.toString();
            });

            pluginProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            pluginProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // 提取JSON响应（忽略调试信息）
                        const lines = responseData.split('\\n');
                        const jsonLine = lines.find(line => {
                            try {
                                JSON.parse(line);
                                return true;
                            } catch {
                                return false;
                            }
                        });

                        if (jsonLine) {
                            resolve(JSON.parse(jsonLine));
                        } else {
                            reject(new Error('插件未返回有效JSON响应'));
                        }
                    } catch (error) {
                        reject(new Error(`响应解析失败: ${error.message}`));
                    }
                } else {
                    reject(new Error(`插件执行失败: ${errorData}`));
                }
            });

            // 发送任务数据
            const taskData = {
                prompt: task.prompt,
                service: task.service,
                ...task.options,
                priority: 'normal'
            };

            pluginProcess.stdin.write(JSON.stringify(taskData));
            pluginProcess.stdin.end();

            // 超时处理
            setTimeout(() => {
                pluginProcess.kill();
                reject(new Error('插件调用超时'));
            }, 30000);
        });
    }

    /**
     * 获取任务状态  
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 任务状态
     */
    getTaskStatus(taskId) {
        return this.taskQueue.get(taskId) || null;
    }

    /**
     * 更新任务状态
     * @param {string} taskId - 任务ID  
     * @param {string} status - 新状态
     * @param {Object} data - 更新数据
     */
    updateTaskStatus(taskId, status, data = {}) {
        const task = this.taskQueue.get(taskId);
        if (task) {
            this.taskQueue.set(taskId, {
                ...task,
                status,
                ...data,
                updatedAt: Date.now()
            });
        }
    }
}

module.exports = AsyncImageProcessor;