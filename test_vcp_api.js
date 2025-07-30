/**
 * 使用VCP相同的fetch方式测试AI API
 */

async function testWithVCPMethod() {
    console.log('=== 使用VCP方式测试AI API ===');
    
    const apiUrl = 'https://itjncsrxaupm.ap-southeast-1.clawcloudrun.com';
    const apiKey = '960512';
    
    const messages = [
        { role: 'system', content: '请简短回复：你是谁？' },
        { role: 'user', content: '你好' }
    ];
    
    const requestBody = {
        model: 'gemini-2.5-flash',
        messages: messages,
        stream: false,
        max_tokens: 50,
        temperature: 0.7
    };
    
    console.log('请求体:', JSON.stringify(requestBody, null, 2));
    
    try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('响应状态:', response.status);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        const responseData = await response.json();
        console.log('响应数据:', JSON.stringify(responseData, null, 2));
        
        const content = responseData.choices?.[0]?.message?.content || '';
        console.log('提取的内容:', `"${content}"`);
        console.log('内容长度:', content.length);
        
        if (!content.trim()) {
            console.error('❌ 内容为空');
            return false;
        } else {
            console.log('✅ 成功获取内容');
            return true;
        }
        
    } catch (error) {
        console.error('❌ 请求失败:', error.message);
        return false;
    }
}

// 测试提示词优化请求
async function testPromptOptimization() {
    console.log('\n=== 测试提示词优化请求 ===');
    
    const apiUrl = 'https://itjncsrxaupm.ap-southeast-1.clawcloudrun.com';
    const apiKey = '960512';
    
    const systemPrompt = `你是一个专业的图片生成提示词优化AI。你的唯一任务是：

📝 **核心功能：提示词优化**
- 接收中文或英文图片描述
- 输出高质量的英文生成提示词
- 针对不同服务优化提示词风格

🎨 **服务特点了解：**
- **ComfyUI**: 适合写实、摄影、复杂场景 → 需要详细的技术描述

⚡ **工作模式：**
1. 理解用户的图片需求
2. 根据目标服务特点优化
3. 直接输出英文提示词（无需解释）
4. 包含适当的质量标签

📋 **输出要求：**
- 只输出优化后的英文提示词
- 不要包含任何解释、说明或其他内容`;

    const userMessage = `请将以下描述优化为适合ComfyUI的英文提示词：
原始描述: 一只可爱的小猫在阳光下睡觉
目标服务: ComfyUI`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ];
    
    const requestBody = {
        model: 'gemini-2.5-flash',
        messages: messages,
        stream: false,
        max_tokens: 500,
        temperature: 0.7
    };
    
    console.log('系统提示词长度:', systemPrompt.length);
    console.log('用户消息长度:', userMessage.length);
    
    try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('响应状态:', response.status);
        
        const responseData = await response.json();
        console.log('响应数据:', JSON.stringify(responseData, null, 2));
        
        const content = responseData.choices?.[0]?.message?.content || '';
        console.log('优化后的提示词:', `"${content}"`);
        console.log('提示词长度:', content.length);
        
        if (!content.trim()) {
            console.error('❌ 提示词优化返回空内容');
            return false;
        } else {
            console.log('✅ 提示词优化成功');
            return true;
        }
        
    } catch (error) {
        console.error('❌ 提示词优化失败:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🧪 开始VCP方式API测试\n');
    
    const basicTest = await testWithVCPMethod();
    const optimizationTest = await testPromptOptimization();
    
    console.log(`\n=== 测试结果 ===`);
    console.log(`基础测试: ${basicTest ? '成功' : '失败'}`);
    console.log(`优化测试: ${optimizationTest ? '成功' : '失败'}`);
    
    return basicTest && optimizationTest;
}

// 运行测试
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testWithVCPMethod, testPromptOptimization };