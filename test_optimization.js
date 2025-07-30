/**
 * 测试完整的提示词优化流程
 */

const AIClient = require('./aiClient');

async function testPromptOptimization() {
    console.log('=== 测试提示词优化 ===\n');
    
    try {
        const aiClient = new AIClient({ debugMode: true });
        
        const result = await aiClient.optimizePrompt(
            '一只可爱的小猫在阳光下睡觉', 
            'ComfyUI'
        );
        
        console.log('\n✅ 提示词优化成功');
        console.log('优化结果:', result);
        console.log('结果长度:', result.length);
        
    } catch (error) {
        console.error('❌ 提示词优化失败:', error.message);
    }
}

testPromptOptimization();