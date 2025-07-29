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
        const { taskId, status, imageUrl, error, placeholder } = update;
        
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
     * 在DOM元素中替换占位符
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    replacePlaceholderInElement(element, placeholder, replacementHtml) {
        // 处理文本节点
        this.replaceInTextNodes(element, placeholder, replacementHtml);
        
        // 处理innerHTML
        if (element.innerHTML && element.innerHTML.includes(placeholder)) {
            element.innerHTML = element.innerHTML.replace(placeholder, replacementHtml);
        }
    }

    /**
     * 在文本节点中替换占位符
     * @param {Element} element - DOM元素
     * @param {string} placeholder - 占位符文本
     * @param {string} replacementHtml - 替换HTML
     */
    replaceInTextNodes(element, placeholder, replacementHtml) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            if (node.textContent.includes(placeholder)) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            if (textNode.textContent.includes(placeholder)) {
                const parent = textNode.parentNode;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = textNode.textContent.replace(placeholder, replacementHtml);
                
                // 将临时div的内容插入到文本节点位置
                while (tempDiv.firstChild) {
                    parent.insertBefore(tempDiv.firstChild, textNode);
                }
                
                // 移除原文本节点
                parent.removeChild(textNode);
            }
        });
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