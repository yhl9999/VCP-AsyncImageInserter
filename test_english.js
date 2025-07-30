/**
 * 测试英文系统提示词
 */

const AIClient = require('./aiClient');

async function testEnglishPrompt() {
    console.log('=== 测试英文系统提示词 ===\n');
    
    try {
        const aiClient = new AIClient({ debugMode: true });
        
        const messages = [
            { 
                role: 'system', 
                content: 'You are an expert at optimizing prompts for image generation. Convert descriptions to English prompts. Output only the optimized English prompt, no explanations.' 
            },
            { 
                role: 'user', 
                content: 'Convert this to an English image generation prompt: "一只可爱的小猫在阳光下睡觉"' 
            }
        ];
        
        const response = await aiClient.sendChatRequest(messages, {
            max_tokens: 100,
            temperature: 0.7
        });
        
        console.log('\n✅ 英文提示词优化成功');
        console.log('优化结果:', response);
        console.log('结果长度:', response.length);
        
    } catch (error) {
        console.error('❌ 英文提示词优化失败:', error.message);
    }
}

testEnglishPrompt();