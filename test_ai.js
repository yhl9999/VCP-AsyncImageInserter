/**
 * AI API测试脚本
 * 用于验证AI服务是否正常工作
 */

const AIClient = require('./aiClient');

async function testAIService() {
    console.log('=== AI服务测试开始 ===');
    
    try {
        // 创建AI客户端实例（使用调试模式）
        const aiClient = new AIClient({ debugMode: true });
        
        console.log('\n1. 测试基础AI响应...');
        const messages = [
            { role: 'system', content: '请简短回复：你是谁？' },
            { role: 'user', content: '你好' }
        ];
        
        const basicResponse = await aiClient.sendChatRequest(messages, {
            temperature: 0.7,
            max_tokens: 50
        });
        
        console.log(`基础响应: "${basicResponse}"`);
        console.log(`响应长度: ${basicResponse ? basicResponse.length : 0}`);
        
        if (!basicResponse || basicResponse.trim() === '') {
            throw new Error('AI服务返回空响应');
        }
        
        console.log('\n2. 测试提示词优化功能...');
        const testPrompt = '一只可爱的小猫在阳光下睡觉';
        const optimizedPrompt = await aiClient.optimizePrompt(testPrompt, 'ComfyUI');
        
        console.log(`原始提示词: "${testPrompt}"`);
        console.log(`优化后提示词: "${optimizedPrompt}"`);
        console.log(`优化后长度: ${optimizedPrompt ? optimizedPrompt.length : 0}`);
        
        if (!optimizedPrompt || optimizedPrompt.trim() === '') {
            throw new Error('提示词优化功能返回空结果');
        }
        
        console.log('\n✅ AI服务测试通过！');
        return true;
        
    } catch (error) {
        console.error(`\n❌ AI服务测试失败: ${error.message}`);
        console.error('错误详情:', error);
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testAIService().then(success => {
        console.log(`\n=== 测试结果: ${success ? '成功' : '失败'} ===`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testAIService };