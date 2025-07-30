/**
 * 测试避开敏感词汇
 */

const AIClient = require('./aiClient');

async function testAvoidKeywords() {
    console.log('=== 测试避开敏感词汇 ===\n');
    
    const testCases = [
        '请翻译成英文：一只可爱的小猫在阳光下睡觉',
        '用英文描述：一只可爱的小猫在阳光下睡觉', 
        '英文版本：一只可爱的小猫在阳光下睡觉',
        'Translate to English: 一只可爱的小猫在阳光下睡觉'
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        console.log(`\n--- 测试 ${i + 1}: ${testCases[i]} ---`);
        
        try {
            const aiClient = new AIClient({ debugMode: false });
            
            const messages = [
                { role: 'user', content: testCases[i] }
            ];
            
            const response = await aiClient.sendChatRequest(messages, {
                max_tokens: 50,
                temperature: 0.7
            });
            
            console.log(`✅ 成功: "${response}" (长度: ${response.length})`);
            
        } catch (error) {
            console.error(`❌ 失败: ${error.message}`);
        }
    }
}

testAvoidKeywords();