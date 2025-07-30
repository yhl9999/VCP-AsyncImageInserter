/**
 * 测试新的API配置
 */

async function testNewAPI() {
    console.log('=== 测试新的API配置 ===');
    
    const apiUrl = 'https://gemini.sbsbsbsb.cv';
    const apiKey = 'sk-DavaRbI1xzbxe7Q6yZ4gdMfJf0J9w4bKY8xqVGQSZ8RRgTeh';
    const model = 'gpt-4o-mini';
    
    const messages = [
        { role: 'user', content: 'Hello!' }
    ];
    
    const requestBody = {
        model: model,
        messages: messages
    };
    
    console.log('API地址:', apiUrl);
    console.log('模型:', model);
    console.log('请求体:', JSON.stringify(requestBody, null, 2));
    
    try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('响应状态:', response.status);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const responseData = await response.json();
            console.log('响应数据:', JSON.stringify(responseData, null, 2));
            
            const content = responseData.choices?.[0]?.message?.content || '';
            console.log('AI回复:', `"${content}"`);
            console.log('回复长度:', content.length);
            
            if (content.trim()) {
                console.log('✅ 新API配置工作正常');
                return true;
            } else {
                console.error('❌ AI回复为空');
                return false;
            }
        } else {
            const errorText = await response.text();
            console.error(`❌ API请求失败: ${response.status}`);
            console.error('错误信息:', errorText);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 请求异常:', error.message);
        return false;
    }
}

async function testPromptOptimizationWithNewAPI() {
    console.log('\n=== 测试新API的提示词优化 ===');
    
    const apiUrl = 'https://gemini.sbsbsbsb.cv';
    const apiKey = 'sk-DavaRbI1xzbxe7Q6yZ4gdMfJf0J9w4bKY8xqVGQSZ8RRgTeh';
    const model = 'gpt-4o-mini';
    
    const messages = [
        {
            role: 'system',
            content: `你是一个专业的图片生成提示词优化AI。

任务：将中文图片描述转换为高质量的英文提示词
要求：
- 输出详细的英文描述
- 包含摄影术语和质量标签
- 适合ComfyUI图片生成
- 只输出优化后的英文提示词，不要解释`
        },
        {
            role: 'user',
            content: '请优化这个描述：一只可爱的小猫在阳光下睡觉'
        }
    ];
    
    const requestBody = {
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
    };
    
    try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('响应状态:', response.status);
        
        if (response.ok) {
            const responseData = await response.json();
            const content = responseData.choices?.[0]?.message?.content || '';
            
            console.log('原始描述: 一只可爱的小猫在阳光下睡觉');
            console.log('优化后提示词:', `"${content}"`);
            console.log('提示词长度:', content.length);
            
            if (content.trim()) {
                console.log('✅ 提示词优化成功');
                return true;
            } else {
                console.error('❌ 优化结果为空');
                return false;
            }
        } else {
            const errorText = await response.text();
            console.error(`❌ 优化请求失败: ${response.status}`);
            console.error('错误信息:', errorText);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 优化请求异常:', error.message);
        return false;
    }
}

async function runNewAPITests() {
    console.log('🧪 开始测试新的API配置\n');
    
    const basicTest = await testNewAPI();
    const optimizationTest = await testPromptOptimizationWithNewAPI();
    
    console.log(`\n=== 测试结果 ===`);
    console.log(`基础测试: ${basicTest ? '成功' : '失败'}`);
    console.log(`优化测试: ${optimizationTest ? '成功' : '失败'}`);
    
    if (basicTest && optimizationTest) {
        console.log('🎉 新API配置完全正常，可以使用！');
    } else {
        console.log('❌ 新API配置仍有问题');
    }
    
    return basicTest && optimizationTest;
}

// 运行测试
if (require.main === module) {
    runNewAPITests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testNewAPI, testPromptOptimizationWithNewAPI };