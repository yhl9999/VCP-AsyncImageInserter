/**
 * 测试不使用system消息
 */

const AIClient = require('./aiClient');

async function testWithoutSystem() {
    console.log('=== 测试不使用system消息 ===\n');
    
    try {
        const aiClient = new AIClient({ debugMode: true });
        
        const messages = [
            { 
                role: 'user', 
                content: '请将"一只可爱的小猫在阳光下睡觉"转换为英文图片生成提示词，只输出英文提示词，不要解释。' 
            }
        ];
        
        const response = await aiClient.sendChatRequest(messages, {
            max_tokens: 100,
            temperature: 0.7
        });
        
        console.log('\n✅ 无system消息优化成功');
        console.log('优化结果:', response);
        console.log('结果长度:', response.length);
        
    } catch (error) {
        console.error('❌ 无system消息优化失败:', error.message);
    }
}

testWithoutSystem();