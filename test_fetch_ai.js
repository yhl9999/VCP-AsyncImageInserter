/**
 * 使用fetch版本的AI客户端测试
 */

class FetchAIClient {
    constructor() {
        this.apiUrl = 'https://gemini.sbsbsbsb.cv';
        this.apiKey = 'sk-DavaRbI1xzbxe7Q6yZ4gdMfJf0J9w4bKY8xqVGQSZ8RRgTeh';
        this.model = 'gpt-4o-mini';
        this.timeout = 60000;
    }

    async sendChatRequest(messages, options = {}) {
        const requestPayload = {
            model: options.model || this.model,
            messages: messages,
            stream: false,
            max_tokens: options.max_tokens || 500,
            temperature: options.temperature || 0.7
        };

        console.log('[FetchAI] 发送请求到:', this.apiUrl);
        console.log('[FetchAI] 请求载荷:', JSON.stringify(requestPayload, null, 2));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('[FetchAI] 响应状态:', response.status);
            console.log('[FetchAI] 响应头:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[FetchAI] API错误:', response.status, errorText);
                throw new Error(`API请求失败: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('[FetchAI] 响应数据:', JSON.stringify(result, null, 2));

            const content = result.choices?.[0]?.message?.content || '';
            console.log('[FetchAI] 提取内容:', `"${content}"`);

            return content;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`[FetchAI] 请求超时 (${this.timeout}ms)`);
                throw new Error(`请求超时: ${this.timeout}ms`);
            }
            console.error('[FetchAI] 请求失败:', error);
            throw error;
        }
    }

    async optimizePrompt(prompt, service = 'ComfyUI', options = {}) {
        const systemPrompt = `你是一个专业的图片生成提示词优化AI。

任务：将中文图片描述转换为高质量的英文提示词
要求：
- 输出详细的英文描述
- 包含摄影术语和质量标签
- 适合${service}图片生成
- 只输出优化后的英文提示词，不要解释`;

        const userMessage = `请优化这个描述：${prompt}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];

        console.log('[FetchAI] 开始优化提示词');
        console.log('[FetchAI] 原始描述:', prompt);
        console.log('[FetchAI] 目标服务:', service);

        const optimizedPrompt = await this.sendChatRequest(messages, {
            temperature: 0.7,
            max_tokens: 500
        });

        console.log('[FetchAI] 优化后提示词:', optimizedPrompt);
        console.log('[FetchAI] 提示词长度:', optimizedPrompt ? optimizedPrompt.length : 0);

        if (!optimizedPrompt || optimizedPrompt.trim() === '') {
            throw new Error('AI优化返回空提示词');
        }

        return optimizedPrompt.trim();
    }
}

async function testFetchAI() {
    console.log('=== 测试Fetch版本AI客户端 ===\n');

    const client = new FetchAIClient();

    try {
        // 1. 基础测试
        console.log('1. 基础响应测试...');
        const basicResponse = await client.sendChatRequest([
            { role: 'user', content: 'Hello! Please respond in Chinese.' }
        ], { max_tokens: 100 });

        if (basicResponse && basicResponse.trim()) {
            console.log('✅ 基础测试成功');
        } else {
            console.error('❌ 基础测试失败 - 响应为空');
            return false;
        }

        // 2. 提示词优化测试
        console.log('\n2. 提示词优化测试...');
        const optimizedPrompt = await client.optimizePrompt('一只可爱的小猫在阳光下睡觉', 'ComfyUI');

        if (optimizedPrompt && optimizedPrompt.trim()) {
            console.log('✅ 提示词优化成功');
            console.log('原始: 一只可爱的小猫在阳光下睡觉');
            console.log('优化:', optimizedPrompt);
        } else {
            console.error('❌ 提示词优化失败');
            return false;
        }

        console.log('\n🎉 Fetch版本AI客户端测试成功！');
        return true;

    } catch (error) {
        console.error('\n❌ Fetch版本AI客户端测试失败:', error.message);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testFetchAI().then(success => {
        console.log(`\n=== 测试结果: ${success ? '成功' : '失败'} ===`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试异常:', error);
        process.exit(1);
    });
}

module.exports = { FetchAIClient, testFetchAI };