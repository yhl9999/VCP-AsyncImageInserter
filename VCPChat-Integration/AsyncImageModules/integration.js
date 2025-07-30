/**
 * AsyncImage集成到VCPChat消息渲染
 * 在消息渲染时自动处理[IMG:xxx]格式
 */

// 浏览器环境，直接定义类而不使用require
class AsyncImageProcessor {
    constructor() {
        this.taskQueue = new Map();
    }
}

class PlaceholderReplacer {
    constructor() {
        this.activePlaceholders = new Map();
    }
    
    registerPlaceholder(taskId, placeholder, containerElement) {
        console.log(`[PlaceholderReplacer] 注册占位符: ${taskId}`);
        this.activePlaceholders.set(taskId, {
            placeholder,
            containerElement,
            registeredAt: Date.now()
        });
    }
    
    handleImageUpdate(data) {
        console.log('[PlaceholderReplacer] 处理图片更新:', data);
        const { placeholderId, placeholder, imageUrl, imageHtml, success } = data;
        
        if (this.activePlaceholders.has(placeholderId)) {
            const placeholderInfo = this.activePlaceholders.get(placeholderId);
            this.replacePlaceholderInDOM(placeholder, success ? imageHtml : `<span style="color: red;">图片生成失败</span>`, placeholderInfo.containerElement);
            this.activePlaceholders.delete(placeholderId);
        }
    }
    
    replacePlaceholderInDOM(placeholder, replacement, containerElement) {
        if (containerElement) {
            const content = containerElement.innerHTML;
            if (content.includes(placeholder)) {
                containerElement.innerHTML = content.replace(placeholder, replacement);
                console.log(`[PlaceholderReplacer] 占位符已替换: ${placeholder}`);
            }
        }
    }
    
    getStatus() {
        return {
            activePlaceholders: this.activePlaceholders.size
        };
    }
    
    cleanup() {
        this.activePlaceholders.clear();
    }
}

class AsyncImageIntegration {
    constructor() {
        this.processor = new AsyncImageProcessor();
        this.replacer = new PlaceholderReplacer();
        this.websocket = null;
        this.isEnabled = true;
        this.reconnectAttempts = 0;
        
        // 图片缓存系统
        this.imageCache = new Map();
        this.loadImageCache();

        // 加载CSS样式
        this.loadStyles();
        
        // 初始化WebSocket连接
        this.initWebSocket();
        
        // 前端重启后，扫描页面中的占位符并恢复缓存图片
        this.initializeCachedImages();
    }

    /**
     * 初始化页面中的缓存图片（前端重启后使用）
     */
    initializeCachedImages() {
        // 延迟执行，确保DOM完全加载
        setTimeout(() => {
            try {
                this.scanAndRestoreCachedImages();
            } catch (error) {
                console.error('[AsyncImage] 初始化缓存图片失败:', error);
            }
        }, 1000);
    }

    /**
     * 扫描页面中的占位符并恢复缓存图片
     */
    scanAndRestoreCachedImages() {
        console.log('[AsyncImage] 扫描页面中的占位符...');
        
        // 查找所有消息容器
        const messageContainers = document.querySelectorAll('.message-content, .ai-message, .user-message, [data-message-content]');
        let restoredCount = 0;
        
        messageContainers.forEach(container => {
            const content = container.innerHTML || container.textContent || '';
            if (content.includes('[ASYNC_IMG_')) {
                // 找到包含占位符的容器，处理其内容
                this.processMessageContent(content, container).then(processedContent => {
                    if (processedContent !== content) {
                        container.innerHTML = processedContent;
                        restoredCount++;
                        console.log(`[AsyncImage] 恢复容器中的缓存图片`);
                    }
                }).catch(error => {
                    console.warn('[AsyncImage] 处理容器占位符失败:', error);
                });
            }
        });
        
        // 如果没有找到标准容器，尝试全页面扫描
        if (messageContainers.length === 0) {
            this.performFullPageScan();
        }
        
        console.log(`[AsyncImage] 页面扫描完成，处理了 ${messageContainers.length} 个容器`);
    }

    /**
     * 执行全页面占位符扫描（fallback方案）
     */
    performFullPageScan() {
        console.log('[AsyncImage] 执行全页面占位符扫描...');
        
        const bodyText = document.body.innerHTML;
        const placeholderPattern = /\[ASYNC_IMG_([^\]]+)\]/g;
        let match;
        let replacements = [];
        
        while ((match = placeholderPattern.exec(bodyText)) !== null) {
            const placeholderId = match[1];
            const placeholder = match[0];
            
            // 检查缓存
            const cachedImage = this.getFromEnhancedCache(placeholderId);
            if (cachedImage) {
                const imageHtml = this.getBestImageHtml(cachedImage, placeholder);
                replacements.push({ placeholder, imageHtml });
            } else {
                const offlineImage = this.getOfflineImage(placeholderId);
                if (offlineImage && offlineImage.base64Data) {
                    const offlineHtml = `<img src="${offlineImage.base64Data}" alt="${offlineImage.description}" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 5px; max-width: 300px;" title="离线缓存图片">`;
                    replacements.push({ placeholder, imageHtml: offlineHtml });
                }
            }
        }
        
        // 执行替换
        let updatedContent = bodyText;
        replacements.forEach(({ placeholder, imageHtml }) => {
            updatedContent = updatedContent.replace(placeholder, imageHtml);
        });
        
        if (replacements.length > 0) {
            document.body.innerHTML = updatedContent;
            console.log(`[AsyncImage] 全页面扫描恢复了 ${replacements.length} 个缓存图片`);
        }
    }

    /**
     * 加载图片缓存
     */
    loadImageCache() {
        try {
            const cachedData = localStorage.getItem('asyncImageCache');
            if (cachedData) {
                const cacheData = JSON.parse(cachedData);
                this.imageCache = new Map(cacheData);
                console.log(`[AsyncImage] 加载了 ${this.imageCache.size} 个缓存图片`);
            }
        } catch (error) {
            console.error('[AsyncImage] 缓存加载失败:', error);
            this.imageCache = new Map();
        }
    }

    /**
     * 保存图片缓存
     */
    saveImageCache() {
        try {
            const cacheData = Array.from(this.imageCache.entries());
            localStorage.setItem('asyncImageCache', JSON.stringify(cacheData));
        } catch (error) {
            console.error('[AsyncImage] 缓存保存失败:', error);
        }
    }

    /**
     * 添加图片到缓存
     */
    addToCache(placeholderId, imageData) {
        this.imageCache.set(placeholderId, {
            ...imageData,
            cachedAt: Date.now()
        });
        this.saveImageCache();
    }

    /**
     * 从缓存获取图片
     */
    getFromCache(placeholderId) {
        return this.imageCache.get(placeholderId);
    }

    /**
     * 加载AsyncImage样式
     */
    loadStyles() {
        try {
            // 检查是否已经加载过样式
            if (document.getElementById('async-image-styles')) {
                return;
            }

            const link = document.createElement('link');
            link.id = 'async-image-styles';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = 'AsyncImageModules/async-image.css';
            
            link.onload = () => {
                console.log('[AsyncImage] 样式文件加载成功');
            };
            
            link.onerror = () => {
                console.error('[AsyncImage] 样式文件加载失败');
            };

            document.head.appendChild(link);
        } catch (error) {
            console.error('[AsyncImage] 样式加载失败:', error);
        }
    }

    /**
     * 初始化WebSocket连接
     */
    initWebSocket() {
        try {
            // 连接到VCPToolBox的统一WebSocket服务器
            // 使用AsyncImage专用路径
            const vcpKey = this.getVCPKey();
            const wsUrl = `ws://localhost:6005/vcp-async-image/VCP_Key=${vcpKey}`;
            
            console.log(`[AsyncImage] 尝试连接WebSocket: ${wsUrl}`);
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('[AsyncImage] WebSocket连接已建立');
                this.reconnectAttempts = 0; // 重置重连计数
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('[AsyncImage] WebSocket消息解析失败:', error);
                }
            };

            this.websocket.onclose = (event) => {
                console.log(`[AsyncImage] WebSocket连接已关闭 (code: ${event.code})`);
                this.scheduleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('[AsyncImage] WebSocket错误:', error);
            };

        } catch (error) {
            console.error('[AsyncImage] WebSocket初始化失败:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 计划重连WebSocket
     */
    scheduleReconnect() {
        if (!this.reconnectAttempts) {
            this.reconnectAttempts = 0;
        }
        
        this.reconnectAttempts++;
        const maxAttempts = 10;
        const baseDelay = 3000;
        
        if (this.reconnectAttempts <= maxAttempts) {
            const delay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
            console.log(`[AsyncImage] 将在 ${delay}ms 后重连 (第${this.reconnectAttempts}次尝试)`);
            
            setTimeout(() => {
                if (this.isEnabled) {
                    this.initWebSocket();
                }
            }, delay);
        } else {
            console.error('[AsyncImage] WebSocket重连次数已达上限，停止重连');
        }
    }

    /**
     * 获取VCP_Key配置
     * @returns {string} VCP密钥
     */
    getVCPKey() {
        try {
            // 从全局设置或electronAPI获取配置
            if (window.electronAPI && window.electronAPI.getVCPKey) {
                return window.electronAPI.getVCPKey();
            }
            
            // 从localStorage获取
            const storedKey = localStorage.getItem('VCP_Key');
            if (storedKey) {
                return storedKey;
            }
            
            // 从全局设置获取
            if (window.globalSettings && window.globalSettings.vcpKey) {
                return window.globalSettings.vcpKey;
            }
            
            // 尝试从renderer.js的全局变量获取
            if (window.vcpKey) {
                return window.vcpKey;
            }
            
            console.warn('[AsyncImage] 未找到VCP_Key配置，使用默认值');
            return '123456'; // 临时默认值
        } catch (error) {
            console.error('[AsyncImage] 获取VCP_Key失败:', error);
            return '123456';
        }
    }

    /**
     * 处理WebSocket消息
     * @param {Object} data - 消息数据
     */
    handleWebSocketMessage(data) {
        const { type } = data;

        switch (type) {
            case 'connection_ack':
                console.log('[AsyncImage] WebSocket连接确认:', data.message);
                break;
            case 'async_image_update':
                // VCPToolBox统一WebSocket的AsyncImage更新消息
                this.handleEnhancedImageUpdate(data);
                break;
            case 'placeholder_replace':
                // AsyncImageInserter发送的占位符替换消息
                console.log('[AsyncImage] 收到占位符替换消息:', data);
                this.handleEnhancedImageUpdate(data);
                break;
            case 'task_status_response':
                console.log('[AsyncImage] 任务状态:', data);
                break;
            default:
                console.log('[AsyncImage] 未知WebSocket消息:', data);
        }
    }

    /**
     * 处理增强的图片更新消息（支持Base64数据）
     * @param {Object} data - 更新数据
     */
    handleEnhancedImageUpdate(data) {
        const { placeholderId, placeholder, imageUrl, imageHtml, success, base64Data, thumbnailBase64, description, fileSize } = data;
        
        // 更新DOM中的占位符
        this.replacer.handleImageUpdate(data);
        
        if (success && placeholderId) {
            // 构建增强的缓存数据
            const enhancedImageData = {
                imageUrl: imageUrl,
                imageHtml: imageHtml,
                placeholder: placeholder,
                // 混合存储模式数据
                base64Data: base64Data,
                thumbnailBase64: thumbnailBase64,
                description: description || placeholder,
                fileSize: fileSize || 0,
                cachedAt: Date.now(),
                source: 'AsyncImageInserter'
            };
            
            // 添加到增强缓存
            this.addToEnhancedCache(placeholderId, enhancedImageData);
            
            console.log(`[AsyncImage] 增强图片缓存已更新: ${placeholderId}`, {
                hasBase64: !!base64Data,
                hasThumbnail: !!thumbnailBase64,
                fileSize: fileSize
            });
        }
    }

    /**
     * 添加图片到增强缓存
     * @param {string} placeholderId - 占位符ID
     * @param {Object} imageData - 增强图片数据
     */
    addToEnhancedCache(placeholderId, imageData) {
        this.imageCache.set(placeholderId, imageData);
        this.saveImageCache();
        
        // 如果有Base64数据，也存储一份用于离线访问
        if (imageData.base64Data) {
            this.storeOfflineImage(placeholderId, imageData);
        }
    }

    /**
     * 存储离线图片数据
     * @param {string} placeholderId - 占位符ID  
     * @param {Object} imageData - 图片数据
     */
    storeOfflineImage(placeholderId, imageData) {
        try {
            // 创建离线图片缓存
            const offlineKey = `asyncImageOffline_${placeholderId}`;
            const offlineData = {
                base64Data: imageData.base64Data,
                thumbnailBase64: imageData.thumbnailBase64,
                description: imageData.description,
                cachedAt: imageData.cachedAt
            };
            
            localStorage.setItem(offlineKey, JSON.stringify(offlineData));
            console.log(`[AsyncImage] 离线图片已存储: ${placeholderId}`);
            
        } catch (error) {
            console.warn('[AsyncImage] 离线图片存储失败:', error);
        }
    }

    /**
     * 获取离线图片数据
     * @param {string} placeholderId - 占位符ID
     * @returns {Object|null} 离线图片数据
     */
    getOfflineImage(placeholderId) {
        try {
            const offlineKey = `asyncImageOffline_${placeholderId}`;
            const offlineData = localStorage.getItem(offlineKey);
            return offlineData ? JSON.parse(offlineData) : null;
        } catch (error) {
            console.warn('[AsyncImage] 离线图片获取失败:', error);
            return null;
        }
    }

    /**
     * 处理消息渲染 - 只处理插件返回的占位符，支持增强缓存
     * @param {string} content - 消息内容
     * @param {Element} containerElement - 容器元素
     * @returns {Promise<string>} 处理后的内容
     */
    async processMessageContent(content, containerElement) {
        if (!this.isEnabled || !content.includes('[ASYNC_IMG_')) {
            return content;
        }

        try {
            // 查找所有AsyncImageInserter插件返回的占位符
            const placeholderPattern = /\[ASYNC_IMG_([^\]]+)\]/g;
            const placeholders = [];
            let match;
            let processedContent = content;

            while ((match = placeholderPattern.exec(content)) !== null) {
                const placeholderId = match[1];
                const placeholder = match[0];
                
                // 先检查增强缓存
                const cachedImage = this.getFromEnhancedCache(placeholderId);
                if (cachedImage) {
                    // 如果有缓存，使用最佳可用的图片源
                    const imageHtml = this.getBestImageHtml(cachedImage, placeholder);
                    processedContent = processedContent.replace(placeholder, imageHtml);
                    console.log(`[AsyncImage] 使用增强缓存图片: ${placeholderId}`);
                } else {
                    // 检查离线缓存
                    const offlineImage = this.getOfflineImage(placeholderId);
                    if (offlineImage && offlineImage.base64Data) {
                        const offlineHtml = `<img src="${offlineImage.base64Data}" alt="${offlineImage.description}" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 5px; max-width: 300px;" title="离线缓存图片">`;
                        processedContent = processedContent.replace(placeholder, offlineHtml);
                        console.log(`[AsyncImage] 使用离线缓存图片: ${placeholderId}`);
                    } else {
                        // 没有任何缓存，添加到待处理列表
                        placeholders.push({
                            taskId: placeholderId,
                            placeholder: placeholder
                        });
                    }
                }
            }

            if (placeholders.length > 0) {
                console.log(`[AsyncImage] 检测到 ${placeholders.length} 个未缓存的插件占位符`);

                // 注册占位符到替换器，显示加载状态
                placeholders.forEach(({ taskId, placeholder }) => {
                    this.replacer.registerPlaceholder(taskId, placeholder, containerElement);
                    
                    // 订阅WebSocket更新（如果连接可用）
                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                        this.websocket.send(JSON.stringify({
                            type: 'subscribe_task',
                            payload: {
                                taskId: taskId,
                                placeholder: placeholder
                            }
                        }));
                    }
                });
            }

            // 返回处理后的内容（缓存的图片已经被替换）
            return processedContent;

        } catch (error) {
            console.error('[AsyncImage] 消息处理失败:', error);
            return content; // 出错时返回原内容，不阻塞渲染
        }
    }

    /**
     * 从增强缓存获取图片
     * @param {string} placeholderId - 占位符ID
     * @returns {Object|null} 增强缓存数据
     */
    getFromEnhancedCache(placeholderId) {
        const cached = this.imageCache.get(placeholderId);
        return cached && cached.source === 'AsyncImageInserter' ? cached : null;
    }

    /**
     * 获取最佳的图片HTML
     * @param {Object} cachedImage - 缓存的图片数据
     * @param {string} placeholder - 原占位符
     * @returns {string} 图片HTML
     */
    getBestImageHtml(cachedImage, placeholder) {
        // 如果有预构建的HTML，优先使用
        if (cachedImage.imageHtml) {
            return cachedImage.imageHtml;
        }
        
        // 否则根据可用数据构建HTML
        const style = "border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 5px; max-width: 300px;";
        const alt = cachedImage.description || placeholder;
        
        if (cachedImage.base64Data && cachedImage.imageUrl) {
            // 混合模式：URL优先，Base64回退
            return `<img src="${cachedImage.imageUrl}" data-base64="${cachedImage.base64Data}" alt="${alt}" style="${style}" 
                    onerror="this.src=this.dataset.base64; this.removeAttribute('data-base64');" title="混合缓存图片">`;
        } else if (cachedImage.base64Data) {
            // 仅Base64
            return `<img src="${cachedImage.base64Data}" alt="${alt}" style="${style}" title="Base64缓存图片">`;
        } else if (cachedImage.imageUrl) {
            // 仅URL
            return `<img src="${cachedImage.imageUrl}" alt="${alt}" style="${style}" title="URL缓存图片">`;
        } else {
            // 降级到缩略图
            return cachedImage.thumbnailBase64 
                ? `<img src="${cachedImage.thumbnailBase64}" alt="${alt}" style="${style}" title="缩略图缓存">` 
                : `<span style="color: #666; font-style: italic;">[图片缓存损坏: ${placeholder}]</span>`;
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

console.log('[AsyncImage] Integration loaded and initialized');