/**
 * 占位符实时替换管理器
 * 处理WebSocket更新并替换DOM中的占位符
 */

class PlaceholderReplacer {
    constructor() {
        this.activePlaceholders = new Map();
        this.updateQueue = [];
        this.isProcessing = false;
    }

    /**
     * 注册占位符
     * @param {string} taskId - 任务ID
     * @param {string} placeholder - 占位符文本
     * @param {Element} element - DOM元素
     */
    registerPlaceholder(taskId, placeholder, element) {
        this.activePlaceholders.set(taskId, {
            placeholder,
            element,
            status: 'pending'
        });

        // 添加loading样式
        this.showLoadingState(element, placeholder);
    }

    /**
     * 显示加载状态
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     */
    showLoadingState(element, placeholder) {
        const loadingHtml = `
            <div class="async-image-placeholder" data-placeholder="${placeholder}">
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">正在生成图片...</span>
                </div>
            </div>
        `;

        // 查找并替换占位符
        this.replacePlaceholderInElement(element, placeholder, loadingHtml);
    }

    /**
     * 处理图片生成完成
     * @param {Object} update - 更新数据
     */
    handleImageUpdate(update) {
        console.log('[PlaceholderReplacer] 收到图片更新:', update);
        
        // 兼容不同的消息格式
        let taskId, status, imageUrl, error, placeholder;
        
        if (update.placeholderId) {
            // AsyncImageInserter插件的格式
            taskId = update.placeholderId;
            status = update.success ? 'completed' : 'failed';
            imageUrl = update.imageUrl;
            error = update.error;
            placeholder = update.placeholder;
        } else if (update.taskId) {
            // 通用格式
            taskId = update.taskId;
            status = update.status;
            imageUrl = update.imageUrl;
            error = update.error;
            placeholder = update.placeholder;
        } else {
            console.warn('[PlaceholderReplacer] 未知的更新消息格式:', update);
            return;
        }
        
        this.updateQueue.push({ taskId, status, imageUrl, error, placeholder });
        
        if (!this.isProcessing) {
            this.processUpdateQueue();
        }
    }

    /**
     * 处理更新队列
     */
    async processUpdateQueue() {
        this.isProcessing = true;

        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            await this.processUpdate(update);
        }

        this.isProcessing = false;
    }

    /**
     * 处理单个更新
     * @param {Object} update - 更新数据
     */
    async processUpdate(update) {
        const { taskId, status, imageUrl, error, placeholder } = update;
        const placeholderInfo = this.activePlaceholders.get(taskId);

        if (!placeholderInfo) {
            console.warn('[PlaceholderReplacer] 未找到占位符:', taskId);
            return;
        }

        let replacementHtml = '';

        if (status === 'completed' && imageUrl) {
            // 生成成功
            replacementHtml = `
                <div class="async-image-result success">
                    <img src="${imageUrl}" 
                         alt="AI generated image" 
                         style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                         onload="this.parentElement.classList.add('loaded')"
                         onerror="this.parentElement.classList.add('error')">
                </div>
            `;
        } else {
            // 生成失败
            replacementHtml = `
                <div class="async-image-result error">
                    <div class="error-message">
                        ⚠️ 图片生成失败: ${error || '未知错误'}
                        <button onclick="window.retryImageGeneration('${taskId}')" class="retry-btn">重试</button>
                    </div>
                </div>
            `;
        }

        // 执行替换
        this.replacePlaceholderInElement(
            placeholderInfo.element, 
            placeholderInfo.placeholder, 
            replacementHtml
        );

        // 更新状态
        placeholderInfo.status = status;
        
        // 如果完成，从活跃列表中移除
        if (status === 'completed' || status === 'failed') {
            this.activePlaceholders.delete(taskId);
        }
    }

    /**
     * 在DOM元素中安全替换占位符
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    replacePlaceholderInElement(element, placeholder, replacementHtml) {
        try {
            // 使用更安全的替换方式，避免与messageRenderer冲突
            this.safeReplaceInElement(element, placeholder, replacementHtml);
        } catch (error) {
            console.error('[PlaceholderReplacer] DOM替换失败:', error);
            // 失败时尝试简单替换
            this.fallbackReplace(element, placeholder, replacementHtml);
        }
    }

    /**
     * 安全的DOM替换方法
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    safeReplaceInElement(element, placeholder, replacementHtml) {
        // 首先检查元素是否仍在DOM中
        if (!document.contains(element)) {
            console.warn('[PlaceholderReplacer] 元素已从DOM中移除，跳过替换');
            return;
        }

        // 查找所有包含占位符的文本节点
        const textNodes = this.findTextNodesWithPlaceholder(element, placeholder);
        
        if (textNodes.length === 0) {
            // 如果没有文本节点包含占位符，检查innerHTML
            this.replaceInInnerHTML(element, placeholder, replacementHtml);
            return;
        }

        // 替换文本节点中的占位符
        textNodes.forEach(textNode => {
            this.replaceTextNodeContent(textNode, placeholder, replacementHtml);
        });
    }

    /**
     * 查找包含占位符的文本节点
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @returns {Array<Text>} 文本节点数组
     */
    findTextNodesWithPlaceholder(element, placeholder) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    return node.textContent.includes(placeholder) ? 
                           NodeFilter.FILTER_ACCEPT : 
                           NodeFilter.FILTER_REJECT;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    /**
     * 替换文本节点内容
     * @param {Text} textNode - 文本节点
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    replaceTextNodeContent(textNode, placeholder, replacementHtml) {
        if (!textNode.parentNode || !document.contains(textNode)) {
            return;
        }

        const content = textNode.textContent;
        if (!content.includes(placeholder)) {
            return;
        }

        // 分割文本内容
        const parts = content.split(placeholder);
        const parent = textNode.parentNode;
        
        // 创建文档片段来避免多次DOM操作
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < parts.length; i++) {
            // 添加文本部分
            if (parts[i]) {
                fragment.appendChild(document.createTextNode(parts[i]));
            }
            
            // 在非最后部分后添加替换HTML
            if (i < parts.length - 1) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = replacementHtml;
                
                // 将tempDiv的所有子节点移动到fragment
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
            }
        }

        // 一次性替换文本节点
        parent.insertBefore(fragment, textNode);
        parent.removeChild(textNode);
    }

    /**
     * 在innerHTML中替换占位符
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    replaceInInnerHTML(element, placeholder, replacementHtml) {
        if (element.innerHTML && element.innerHTML.includes(placeholder)) {
            // 使用requestAnimationFrame来避免渲染阻塞
            requestAnimationFrame(() => {
                if (document.contains(element)) {
                    element.innerHTML = element.innerHTML.replace(
                        new RegExp(this.escapeRegExp(placeholder), 'g'), 
                        replacementHtml
                    );
                }
            });
        }
    }

    /**
     * 后备替换方法
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    fallbackReplace(element, placeholder, replacementHtml) {
        try {
            if (element.innerHTML && element.innerHTML.includes(placeholder)) {
                element.innerHTML = element.innerHTML.replace(placeholder, replacementHtml);
            }
        } catch (error) {
            console.error('[PlaceholderReplacer] 后备替换也失败:', error);
        }
    }

    /**
     * 转义正则表达式特殊字符
     * @param {string} string - 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 获取活跃占位符状态
     * @returns {Object} 状态统计
     */
    getStatus() {
        const stats = {
            total: this.activePlaceholders.size,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
        };

        this.activePlaceholders.forEach(info => {
            stats[info.status] = (stats[info.status] || 0) + 1;
        });

        return stats;
    }

    /**
     * 清理已完成的占位符
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5分钟

        this.activePlaceholders.forEach((info, taskId) => {
            if (info.createdAt && (now - info.createdAt) > maxAge) {
                this.activePlaceholders.delete(taskId);
            }
        });
    }
}

// 全局占位符替换器实例
window.placeholderReplacer = new PlaceholderReplacer();

// 重试函数
window.retryImageGeneration = function(taskId) {
    console.log('重试图片生成:', taskId);
    // TODO: 实现重试逻辑
};

module.exports = PlaceholderReplacer;