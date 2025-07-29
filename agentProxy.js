/**
 * AgentProxy - Agent调用代理 (基于VCP Agent系统)
 * 负责与ImageGenerator Agent进行通信
 */

const { spawn } = require('child_process');
const path = require('path');

class AgentProxy {
    constructor(options = {}) {
        this.agentId = options.agentId || 'ImageGenerator';
        this.timeout = options.timeout || 300000; // 5分钟超时
        this.debugMode = options.debugMode || false;
        
        // VCP系统配置
        this.vcpConfig = {
            agentPath: this.findAgentPath(),
            vcpServerUrl: options.vcpServerUrl || 'http://localhost:6005',
            apiKey: options.apiKey || ''
        };

        if (this.debugMode) {
            console.log(`[AgentProxy] 初始化完成，Agent路径: ${this.vcpConfig.agentPath}`);
        }
    }

    /**
     * 查找ImageGenerator Agent文件路径
     * @returns {string} Agent文件路径
     */
    findAgentPath() {
        // 相对于插件目录的Agent路径
        const agentPath = path.join(__dirname, '..', '..', 'Agent', `${this.agentId}.txt`);
        
        try {
            const fs = require('fs');
            if (fs.existsSync(agentPath)) {
                return agentPath;
            }
        } catch (error) {
            console.warn(`[AgentProxy] Agent文件检查失败: ${error.message}`);
        }

        return agentPath; // 返回默认路径，即使文件不存在
    }

    /**
     * 调用ImageGenerator Agent
     * @param {Object} request - 生成请求
     * @returns {Promise<Object>} 生成结果
     */
    async callImageGenerationAgent(request) {
        const { prompt, service = 'ComfyUI', options = {} } = request;

        try {
            if (this.debugMode) {
                console.log(`[AgentProxy] 调用ImageGenerator Agent`);
                console.log(`[AgentProxy] 请求参数:`, { prompt, service, options });
            }

            // 构建Agent消息
            const agentMessage = this.buildAgentMessage(prompt, service, options);
            
            // 发送给Agent并等待响应
            const result = await this.sendToImageGeneratorAgent(agentMessage);
            
            if (this.debugMode) {
                console.log(`[AgentProxy] Agent响应:`, result);
            }

            return this.parseAgentResponse(result);

        } catch (error) {
            console.error(`[AgentProxy] Agent调用失败:`, error);
            throw new Error(`ImageGenerator Agent调用失败: ${error.message}`);
        }
    }

    /**
     * 构建发送给ImageGenerator的消息
     * @param {string} prompt - 图片描述
     * @param {string} service - 服务类型
     * @param {Object} options - 选项参数
     * @returns {string} Agent消息
     */
    buildAgentMessage(prompt, service, options) {
        let message = `请帮我生成一张图片：${prompt}`;
        
        // 添加服务偏好（如果指定）
        if (service && service !== 'ComfyUI') {
            message += `\n\n服务要求：请使用 ${service} 生成`;
        }

        // 添加参数要求
        const requirements = [];
        if (options.width && options.width !== 1024) {
            requirements.push(`宽度：${options.width}px`);
        }
        if (options.height && options.height !== 1024) {
            requirements.push(`高度：${options.height}px`);
        }
        if (options.style) {
            requirements.push(`风格：${options.style}`);
        }

        if (requirements.length > 0) {
            message += `\n\n参数要求：${requirements.join('，')}`;
        }

        message += `\n\n请直接生成图片，返回图片URL即可。`;

        return message;
    }

    /**
     * 发送消息给ImageGenerator Agent
     * @param {string} message - 消息内容
     * @returns {Promise<string>} Agent响应
     */
    async sendToImageGeneratorAgent(message) {
        return new Promise((resolve, reject) => {
            // 构建模拟的VCP Agent调用
            // 在实际环境中，这里应该通过VCP的Agent系统调用
            
            if (this.debugMode) {
                console.log(`[AgentProxy] 发送消息给ImageGenerator:`);
                console.log(`[AgentProxy] 消息内容: ${message}`);
            }

            // 模拟Agent响应（实际环境中需要真实调用）
            const mockResponse = this.generateMockResponse(message);
            
            setTimeout(() => {
                resolve(mockResponse);
            }, 2000); // 模拟2秒处理时间
        });
    }

    /**
     * 生成模拟响应（用于测试）
     * @param {string} message - 原始消息
     * @returns {string} 模拟响应
     */
    generateMockResponse(message) {
        // 从消息中提取信息生成模拟响应
        const isComfyUI = message.includes('ComfyUI') || !message.includes('FluxGen') && !message.includes('NovelAI');
        const isFluxGen = message.includes('FluxGen');
        const isNovelAI = message.includes('NovelAI');

        let service = 'ComfyUI';
        if (isFluxGen) service = 'FluxGen';
        if (isNovelAI) service = 'NovelAI';

        // 生成模拟的图片URL
        const mockImageId = Math.random().toString(36).substr(2, 9);
        const mockImageUrl = `http://localhost:6005/pw=123456/images/async/${mockImageId}.png`;

        return `已完成图片生成任务！

服务：${service}
状态：成功生成
图片URL：${mockImageUrl}

<img src="${mockImageUrl}" alt="Generated image" width="300">

任务完成时间：${new Date().toLocaleString()}`;
    }

    /**
     * 解析Agent响应
     * @param {string} rawResponse - 原始响应
     * @returns {Object} 解析后的响应
     */
    parseAgentResponse(rawResponse) {
        try {
            // 提取图片URL
            const imageUrls = this.extractImageUrls(rawResponse);
            
            if (imageUrls.length === 0) {
                throw new Error('Agent响应中未找到有效的图片URL');
            }

            // 提取使用的服务信息
            const serviceMatch = rawResponse.match(/服务[：:](\\s*)(\\w+)/);
            const usedService = serviceMatch ? serviceMatch[2] : 'Unknown';

            // 检查是否成功
            const isSuccess = rawResponse.includes('成功') || rawResponse.includes('完成');

            return {
                success: isSuccess,
                imageUrl: imageUrls[0],
                allImageUrls: imageUrls,
                service: usedService,
                originalResponse: rawResponse,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[AgentProxy] 响应解析失败:`, error);
            throw new Error(`响应解析失败: ${error.message}`);
        }
    }

    /**
     * 从文本中提取图片URL
     * @param {string} text - 文本内容
     * @returns {Array<string>} 图片URL列表
     */
    extractImageUrls(text) {
        // 匹配各种可能的图片URL格式
        const patterns = [
            /https?:\/\/[^\s<>"\\[\\]{}|\\^`]+\\.(png|jpg|jpeg|gif|webp)/gi,
            /src="([^"]*\\.(png|jpg|jpeg|gif|webp)[^"]*)"/gi,
            /图片URL[：:]\\s*([^\\s\\n]+)/gi
        ];

        const urls = new Set();

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const url = match[1] || match[0];
                if (url && url.startsWith('http')) {
                    urls.add(url);
                }
            }
        });

        return Array.from(urls);
    }

    /**
     * 健康检查 - 测试Agent是否可用
     * @returns {Promise<boolean>} 是否可用
     */
    async healthCheck() {
        try {
            const testResult = await this.callImageGenerationAgent({
                prompt: '测试连接 - 简单的蓝色圆形',
                service: 'ComfyUI'
            });
            
            const isHealthy = testResult.success && testResult.imageUrl;
            
            if (this.debugMode) {
                console.log(`[AgentProxy] 健康检查结果: ${isHealthy ? '✅ 正常' : '❌ 异常'}`);
            }
            
            return isHealthy;
            
        } catch (error) {
            console.warn(`[AgentProxy] 健康检查失败:`, error.message);
            return false;
        }
    }

    /**
     * 获取Agent状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            agentId: this.agentId,
            agentPath: this.vcpConfig.agentPath,
            timeout: this.timeout,
            debugMode: this.debugMode,
            vcpServerUrl: this.vcpConfig.vcpServerUrl
        };
    }
}

module.exports = AgentProxy;