/**
 * AI客户端 - 负责与AI API通信进行提示词优化
 * 使用与VCP前端相同的fetch方式
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载VCP的配置文件
const vcpConfigPath = path.join(__dirname, '../../config.env');
if (fs.existsSync(vcpConfigPath)) {
    dotenv.config({ path: vcpConfigPath });
}

class AIClient {
    constructor(options = {}) {
        // 使用VCP的实际配置，优先使用传入的options
        this.apiUrl = options.apiUrl || process.env.API_URL;
        this.apiKey = options.apiKey || process.env.API_Key;
        this.model = options.model || 'gemini-2.5-flash';
        this.timeout = options.timeout || 60000; // 增加到60秒
        this.debugMode = options.debugMode || false;

        // 验证API配置
        if (!this.apiUrl || !this.apiKey) {
            console.error(`[AIClient] 配置错误 - API_URL: ${this.apiUrl}, API_Key: ${this.apiKey ? '已设置' : '未设置'}`);
            throw new Error('AI API配置不完整，请检查VCP的config.env中的API_URL和API_Key配置');
        }

        if (this.debugMode) {
            console.log(`[AIClient] 初始化完成`);
            console.log(`[AIClient] API地址: ${this.apiUrl}`);
            console.log(`[AIClient] 模型: ${this.model}`);
            console.log(`[AIClient] API密钥: ${this.apiKey ? '已设置' : '未设置'}`);
        }
    }

    /**
     * 使用VCP相同的fetch方式发送聊天请求
     * @param {Array} messages - 消息数组
     * @param {Object} options - 可选参数
     * @returns {Promise<string>} AI响应内容
     */
    async sendChatRequest(messages, options = {}) {
        const requestBody = {
            model: options.model || this.model,
            messages: messages,
            stream: false,
            max_tokens: options.max_tokens || 4000,
            temperature: options.temperature || 0.7
        };

        if (this.debugMode) {
            console.log(`[AIClient] 发送请求到 ${this.apiUrl}`);
            console.log(`[AIClient] 消息数量: ${messages.length}`);
            console.log(`[AIClient] 请求载荷:`, JSON.stringify(requestBody, null, 2));
        }

        try {
            const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (this.debugMode) {
                console.log(`[AIClient] 响应状态码: ${response.status}`);
                console.log(`[AIClient] 响应Headers:`, Object.fromEntries(response.headers.entries()));
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AIClient] API错误: ${response.status}`);
                console.error(`[AIClient] 错误内容: ${errorText}`);
                throw new Error(`AI API请求失败: ${response.status} - ${errorText}`);
            }

            const responseData = await response.json();
            const content = responseData.choices?.[0]?.message?.content || '';
            
            if (this.debugMode) {
                console.log(`[AIClient] 响应内容长度: ${content.length}`);
                if (content.trim()) {
                    console.log(`[AIClient] AI响应成功: ${content.substring(0, 100)}...`);
                } else {
                    console.error(`[AIClient] AI返回空内容`);
                    console.error(`[AIClient] 完整响应:`, JSON.stringify(responseData, null, 2));
                }
            }
            
            return content;

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error(`[AIClient] 请求超时 (${this.timeout}ms)`);
                throw new Error(`请求超时: ${this.timeout}ms`);
            } else if (error.name === 'AbortError') {
                console.error(`[AIClient] 请求被中止`);
                throw new Error(`请求被中止`);
            } else {
                console.error(`[AIClient] 请求失败:`, error.message);
                throw new Error(`网络请求失败: ${error.message}`);
            }
        }
    }

    /**
     * 优化图片生成提示词
     * @param {string} prompt - 原始提示词
     * @param {string} service - 服务类型 (ComfyUI/FluxGen/NovelAI)
     * @param {Object} options - 可选参数
     * @returns {Promise<string>} 优化后的英文提示词
     */
    async optimizePrompt(prompt, service = 'ComfyUI', options = {}) {
        const systemPrompt = this.buildPromptOptimizationSystemPrompt();
        const userMessage = this.buildPromptOptimizationUserMessage(prompt, service, options);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        if (this.debugMode) {
            console.log(`[AIClient] 优化提示词作为后端Agent`);
            console.log(`[AIClient] 原始描述: ${prompt}`);
            console.log(`[AIClient] 目标服务: ${service}`);
        }

        const optimizedPrompt = await this.sendChatRequest(messages, {
            temperature: 0.7,
            max_tokens: 500
        });

        if (this.debugMode) {
            console.log(`[AIClient] 优化后提示词: ${optimizedPrompt}`);
            console.log(`[AIClient] 提示词长度: ${optimizedPrompt ? optimizedPrompt.length : 0}`);
        }

        const trimmedPrompt = optimizedPrompt ? optimizedPrompt.trim() : '';
        
        if (!trimmedPrompt) {
            console.error(`[AIClient] AI返回空提示词`);
            console.error(`[AIClient] 原始响应: "${optimizedPrompt}"`);
            console.error(`[AIClient] API配置 - URL: ${this.apiUrl}, 有API密钥: ${!!this.apiKey}`);
            throw new Error('AI服务返回空的优化提示词，请检查AI服务配置和网络连接');
        }

        return trimmedPrompt;
    }

    /**
     * 构建提示词优化的系统提示词
     * @returns {string} 系统提示词
     */
    buildPromptOptimizationSystemPrompt() {
        return `你是专业的图片生成提示词优化专家。任务：将中文或英文描述转换为高质量的英文图片生成提示词。要求：1. 只输出优化后的英文提示词 2. 不要包含解释或说明 3. 包含必要的风格和质量描述 4. 适合AI图片生成模型使用`;
    }

    /**
     * 构建提示词优化的用户消息
     * @param {string} prompt - 原始提示词
     * @param {string} service - 服务类型
     * @param {Object} options - 可选参数
     * @returns {string} 用户消息
     */
    buildPromptOptimizationUserMessage(prompt, service, options) {
        let message = `请将以下描述转换为适合${service}的英文提示词：${prompt}`;

        // 添加服务特定的风格指导
        if (service === 'ComfyUI') {
            message += ` 风格：写实摄影风格，包含详细描述。`;
        } else if (service === 'FluxGen') {
            message += ` 风格：艺术创作风格，注重美学表达。`;
        } else if (service === 'NovelAI') {
            message += ` 风格：动漫插画风格，使用二次元术语。`;
        }

        return message;
    }
}

module.exports = AIClient;