/**
 * AgentProxy - 图片生成代理 (正确架构)
 * 1. 使用AIClient调用后端AI优化提示词
 * 2. 程序直接调用VCP插件生成图片
 */

const path = require('path');
const AIClient = require('./aiClient');

class AgentProxy {
    constructor(options = {}) {
        this.timeout = options.timeout || 300000; // 5分钟超时
        this.debugMode = options.debugMode || false;
        
        // 创建AI客户端
        this.aiClient = new AIClient({
            apiUrl: options.aiApiUrl || process.env.API_URL,
            apiKey: options.aiApiKey || process.env.API_Key,
            debugMode: this.debugMode,
            timeout: this.timeout
        });

        // VCP服务器配置
        this.vcpServerUrl = options.vcpServerUrl || process.env.VCP_SERVER_URL || 'http://localhost:6005';
        this.vcpApiKey = options.apiKey || process.env.VCP_API_KEY || '123456';

        if (this.debugMode) {
            console.log(`[AgentProxy] 初始化完成，使用正确架构`);
            console.log(`[AgentProxy] VCP服务器: ${this.vcpServerUrl}`);
            console.log(`[AgentProxy] AI API: ${options.aiApiUrl || process.env.API_URL || 'default'}`);
        }
    }

    /**
     * 调用图片生成流程
     * @param {Object} request - 生成请求
     * @returns {Promise<Object>} 生成结果
     */
    async callImageGenerationAgent(request) {
        const { prompt, service = 'ComfyUI', options = {} } = request;

        try {
            if (this.debugMode) {
                console.log(`[AgentProxy] 开始图片生成流程`);
                console.log(`[AgentProxy] 原始请求:`, { prompt, service, options });
            }

            // 检查原始prompt是否为空
            if (!prompt || prompt.trim() === '') {
                throw new Error('prompt 参数不能为空');
            }

            // 步骤1: 使用AI Agent优化提示词
            let optimizedPrompt;
            try {
                optimizedPrompt = await this.aiClient.optimizePrompt(prompt, service, options);
                
                if (this.debugMode) {
                    console.log(`[AgentProxy] AI优化后的提示词: ${optimizedPrompt}`);
                }
            } catch (aiError) {
                console.error(`[AgentProxy] AI优化失败，使用原始prompt:`, aiError.message);
                optimizedPrompt = prompt; // 降级到原始prompt
                
                if (this.debugMode) {
                    console.log(`[AgentProxy] 降级使用原始提示词: ${optimizedPrompt}`);
                }
            }

            // 检查优化后的prompt是否为空
            if (!optimizedPrompt || optimizedPrompt.trim() === '') {
                throw new Error('优化后的prompt为空，请检查输入内容');
            }

            // 步骤2: 程序直接调用VCP生图插件
            const imageResult = await this.callVCPPluginDirectly(optimizedPrompt, service, options);
            
            if (this.debugMode) {
                console.log(`[AgentProxy] 生图插件返回结果:`, imageResult);
            }

            return imageResult;

        } catch (error) {
            console.error(`[AgentProxy] 图片生成流程失败:`, error);
            throw new Error(`图片生成失败: ${error.message}`);
        }
    }

    /**
     * 程序直接调用VCP插件 - 通过VCP的PluginManager
     * @param {string} optimizedPrompt - 优化后的提示词
     * @param {string} service - 服务类型
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 插件返回结果
     */
    async callVCPPluginDirectly(optimizedPrompt, service, options) {
        try {
            // 确定要调用的插件
            const pluginMap = {
                'ComfyUI': 'ComfyUIGen',
                'FluxGen': 'FluxGen', 
                'NovelAI': 'NovelAIGen'
            };
            
            const pluginName = pluginMap[service] || 'ComfyUIGen';
            
            if (this.debugMode) {
                console.log(`[AgentProxy] 通过PluginManager调用插件: ${pluginName}`);
                console.log(`[AgentProxy] 使用优化提示词: ${optimizedPrompt}`);
            }

            // 构建插件调用参数
            const pluginArgs = {
                prompt: optimizedPrompt
            };
            
            // 添加可选参数
            if (options.width) pluginArgs.width = options.width;
            if (options.height) pluginArgs.height = options.height;
            if (options.steps) pluginArgs.steps = options.steps;
            if (options.style) pluginArgs.style = options.style;
            if (options.negative_prompt) pluginArgs.negative_prompt = options.negative_prompt;

            // 尝试获取全局PluginManager实例
            if (typeof global.pluginManager !== 'undefined') {
                if (this.debugMode) {
                    console.log(`[AgentProxy] 使用全局PluginManager调用插件`);
                }
                
                const result = await global.pluginManager.executePlugin(pluginName, JSON.stringify(pluginArgs));
                
                if (this.debugMode) {
                    console.log(`[AgentProxy] PluginManager返回:`, result);
                }
                
                return this.parsePluginManagerResponse(result);
                
            } else {
                // 如果没有全局PluginManager，尝试require方式
                try {
                    const pluginManager = require('../../Plugin');
                    
                    // 确保插件已加载
                    if (pluginManager.plugins.size === 0) {
                        if (this.debugMode) {
                            console.log(`[AgentProxy] PluginManager插件未加载，尝试加载插件...`);
                        }
                        // 设置项目基础路径
                        pluginManager.projectBasePath = path.join(__dirname, '../..');
                        await pluginManager.loadPlugins();
                    }
                    
                    if (this.debugMode) {
                        console.log(`[AgentProxy] 使用require的PluginManager实例调用插件`);
                        console.log(`[AgentProxy] 可用插件:`, Array.from(pluginManager.plugins.keys()));
                    }
                    
                    const result = await pluginManager.executePlugin(pluginName, JSON.stringify(pluginArgs));
                    return this.parsePluginManagerResponse(result);
                    
                } catch (requireError) {
                    console.error(`[AgentProxy] 无法获取PluginManager:`, requireError);
                    throw new Error(`无法调用插件：PluginManager不可用 - ${requireError.message}`);
                }
            }

        } catch (error) {
            console.error(`[AgentProxy] 插件调用失败:`, error);
            throw new Error(`插件调用失败: ${error.message}`);
        }
    }

    /**
     * 解析PluginManager返回的响应
     * @param {Object} response - PluginManager响应对象
     * @returns {Object} 解析结果
     */
    parsePluginManagerResponse(response) {
        try {
            if (this.debugMode) {
                console.log(`[AgentProxy] 解析PluginManager响应:`, response);
            }

            // PluginManager返回格式: {status: "success"/"error", result/error: "..."}
            if (response.status === 'success' && response.result) {
                // 尝试解析result（可能是JSON字符串）
                let resultData = response.result;
                if (typeof resultData === 'string') {
                    try {
                        resultData = JSON.parse(resultData);
                    } catch (parseError) {
                        // 如果不是JSON，直接使用字符串
                        if (this.debugMode) {
                            console.log(`[AgentProxy] result不是JSON，直接使用字符串: ${resultData}`);
                        }
                    }
                }
                
                // 尝试提取图片URL
                const imageUrl = this.extractImageUrl(resultData);
                
                if (imageUrl) {
                    if (this.debugMode) {
                        console.log(`[AgentProxy] 成功提取图片URL: ${imageUrl}`);
                    }
                    
                    return {
                        success: true,
                        imageUrl: imageUrl,
                        originalResponse: response
                    };
                } else {
                    console.warn(`[AgentProxy] 插件响应中未找到图片URL`);
                    console.warn(`[AgentProxy] 插件返回:`, resultData);
                    
                    return {
                        success: false,
                        error: '插件响应中未找到图片URL',
                        originalResponse: response
                    };
                }
            } else {
                // 插件执行失败
                const errorMsg = response.error || '插件执行失败';
                console.error(`[AgentProxy] 插件执行失败: ${errorMsg}`);
                
                return {
                    success: false,
                    error: errorMsg,
                    originalResponse: response
                };
            }

        } catch (error) {
            console.error(`[AgentProxy] 响应解析失败:`, error);
            
            return {
                success: false,
                error: `响应解析失败: ${error.message}`,
                originalResponse: response
            };
        }
    }

    /**
     * 从各种格式中提取图片URL
     * @param {any} data - 数据
     * @returns {string|null} 图片URL
     */
    extractImageUrl(data) {
        if (!data) return null;
        
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        
        // 尝试提取图片URL的多种模式
        const urlPatterns = [
            // HTML img标签
            /<img[^>]+src="([^"]+)"/gi,
            // Markdown图片
            /!\[[^\]]*\]\(([^)]+)\)/gi,
            // 直接的URL
            /https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg)/gi,
            // localhost URLs
            /http:\/\/localhost[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg)/gi
        ];

        for (const pattern of urlPatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                if (pattern.toString().includes('src=') || pattern.toString().includes('](')) {
                    // 提取src或markdown中的URL
                    const urlMatch = matches[0].match(/(?:src="|]\()([^"']+)/);
                    if (urlMatch) {
                        return urlMatch[1];
                    }
                } else {
                    // 直接的URL匹配
                    return matches[0];
                }
            }
        }
        
        // 如果是直接的URL字符串
        if (typeof data === 'string' && (data.startsWith('http') || data.includes('localhost'))) {
            return data;
        }
        
        return null;
    }

}

module.exports = AgentProxy;