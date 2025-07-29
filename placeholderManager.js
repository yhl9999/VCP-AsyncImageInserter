/**
 * PlaceholderManager - 占位符管理器
 * 负责生成、跟踪和管理异步图片占位符
 */

class PlaceholderManager {
    constructor(options = {}) {
        this.prefix = options.prefix || 'ASYNC_IMG';
        this.activePlaceholders = new Map(); // 活跃占位符追踪
        this.completedPlaceholders = new Map(); // 完成占位符记录
    }

    /**
     * 生成唯一占位符ID
     * @returns {string} 占位符ID
     */
    generatePlaceholderId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}_${random}`;
    }

    /**
     * 创建占位符
     * @param {Object} taskData - 任务数据
     * @returns {Object} 占位符信息
     */
    createPlaceholder(taskData) {
        const placeholderId = this.generatePlaceholderId();
        const placeholder = `[${this.prefix}_${placeholderId}]`;
        
        const placeholderInfo = {
            id: placeholderId,
            placeholder: placeholder,
            prompt: taskData.prompt,
            service: taskData.service,
            options: taskData.options || {},
            status: 'queued',
            createdAt: new Date().toISOString(),
            priority: taskData.priority || 'normal'
        };

        // 添加到活跃占位符追踪
        this.activePlaceholders.set(placeholderId, placeholderInfo);

        return placeholderInfo;
    }

    /**
     * 更新占位符状态
     * @param {string} placeholderId - 占位符ID
     * @param {string} status - 新状态
     * @param {Object} data - 附加数据
     */
    updatePlaceholderStatus(placeholderId, status, data = {}) {
        const placeholderInfo = this.activePlaceholders.get(placeholderId);
        if (!placeholderInfo) {
            console.warn(`[PlaceholderManager] 未找到占位符: ${placeholderId}`);
            return false;
        }

        placeholderInfo.status = status;
        placeholderInfo.updatedAt = new Date().toISOString();
        
        // 合并附加数据
        Object.assign(placeholderInfo, data);

        // 如果任务完成或失败，移动到完成列表
        if (status === 'completed' || status === 'failed') {
            this.completedPlaceholders.set(placeholderId, placeholderInfo);
            this.activePlaceholders.delete(placeholderId);
        }

        return true;
    }

    /**
     * 获取占位符信息
     * @param {string} placeholderId - 占位符ID
     * @returns {Object|null} 占位符信息
     */
    getPlaceholderInfo(placeholderId) {
        return this.activePlaceholders.get(placeholderId) || 
               this.completedPlaceholders.get(placeholderId) || 
               null;
    }

    /**
     * 获取所有活跃占位符
     * @returns {Array} 活跃占位符列表
     */
    getActivePlaceholders() {
        return Array.from(this.activePlaceholders.values());
    }

    /**
     * 获取指定状态的占位符
     * @param {string} status - 状态筛选
     * @returns {Array} 占位符列表
     */
    getPlaceholdersByStatus(status) {
        return this.getActivePlaceholders().filter(p => p.status === status);
    }

    /**
     * 清理过期占位符
     * @param {number} maxAge - 最大保留时间(毫秒)
     */
    cleanupExpiredPlaceholders(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
        const now = Date.now();
        const expiredIds = [];

        for (const [id, info] of this.completedPlaceholders) {
            const createdTime = new Date(info.createdAt).getTime();
            if (now - createdTime > maxAge) {
                expiredIds.push(id);
            }
        }

        expiredIds.forEach(id => {
            this.completedPlaceholders.delete(id);
        });

        if (expiredIds.length > 0) {
            console.log(`[PlaceholderManager] 清理了 ${expiredIds.length} 个过期占位符`);
        }
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const active = this.getActivePlaceholders();
        return {
            total: active.length + this.completedPlaceholders.size,
            active: active.length,
            completed: this.completedPlaceholders.size,
            byStatus: {
                queued: active.filter(p => p.status === 'queued').length,
                processing: active.filter(p => p.status === 'processing').length,
                completed: this.completedPlaceholders.size
            }
        };
    }
}

module.exports = PlaceholderManager;