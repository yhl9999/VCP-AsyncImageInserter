/**
 * 测试简化的提示词优化
 */

const AIClient = require('./aiClient');

async function testSimpleOptimization() {
    console.log('=== 测试简化的提示词优化 ===\n');
    
    try {
        const aiClient = new AIClient({ debugMode: true });
        
        const messages = [
            { 
                role: 'system', 
                content: '你是图片生成提示词优化专家。将中文描述转换为英文提示词，只输出英文提示词，不要解释。' 
            },
            { 
                role: 'user', 
                content: '请将"一只可爱的小猫在阳光下睡觉"转换为英文图片生成提示词' 
            }
        ];
        
        const response = await aiClient.sendChatRequest(messages, {
            max_tokens: 100,
            temperature: 0.7
        });
        
        console.log('\n✅ 简化提示词优化成功');
        console.log('优化结果:', response);
        console.log('结果长度:', response.length);
        
    } catch (error) {
        console.error('❌ 简化提示词优化失败:', error.message);
    }
}

testSimpleOptimization();