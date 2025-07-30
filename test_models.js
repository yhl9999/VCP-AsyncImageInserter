/**
 * 测试不同模型的响应
 */

const AIClient = require('./aiClient');

async function testDifferentModels() {
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gpt-4o-mini',
        'gpt-3.5-turbo'
    ];
    
    for (const model of models) {
        console.log(`\n=== 测试模型: ${model} ===`);
        
        try {
            const aiClient = new AIClient({ 
                model: model,
                debugMode: false // 减少输出
            });
            
            const response = await aiClient.sendChatRequest([
                { role: 'user', content: '请回复"测试成功"' }
            ], { max_tokens: 50 });
            
            console.log(`✅ ${model}: "${response}" (长度: ${response.length})`);
            
        } catch (error) {
            console.error(`❌ ${model}: ${error.message}`);
        }
    }
}

testDifferentModels();