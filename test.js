/**
 * AsyncImageInserter 测试脚本
 * 验证插件基础功能
 */

const { spawn } = require('child_process');
const path = require('path');

async function testAsyncImageInserter() {
    console.log('🧪 开始测试 AsyncImageInserter 插件...\n');

    const pluginPath = path.join(__dirname, 'AsyncImageInserter.js');
    
    return new Promise((resolve, reject) => {
        const pluginProcess = spawn('node', [pluginPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let responseData = '';
        let errorData = '';

        // 监听输出
        pluginProcess.stdout.on('data', (data) => {
            responseData += data.toString();
            console.log('📤 Plugin Output:', data.toString().trim());
        });

        pluginProcess.stderr.on('data', (data) => {
            errorData += data.toString();
            console.log('⚠️ Plugin Error:', data.toString().trim());
        });

        pluginProcess.on('close', (code) => {
            console.log(`\n🏁 插件进程结束，退出码: ${code}`);
            
            if (code === 0) {
                console.log('✅ 插件测试完成');
                resolve({ responseData, errorData });
            } else {
                console.log('❌ 插件测试失败');
                reject(new Error(`插件退出码: ${code}, 错误: ${errorData}`));
            }
        });

        // 发送测试请求
        const testRequests = [
            {
                prompt: "一个美丽的雪山日出景色，阳光透过云层",
                service: "ComfyUI",
                priority: "normal"
            },
            {
                prompt: "可爱的小猫在花园里玩耍",
                service: "NovelAI", 
                width: 1024,
                height: 1024,
                priority: "high"
            }
        ];

        console.log('📝 发送测试请求...\n');

        testRequests.forEach((request, index) => {
            setTimeout(() => {
                console.log(`🚀 发送请求 ${index + 1}:`, request);
                pluginProcess.stdin.write(JSON.stringify(request) + '\n');
                
                // 最后一个请求后结束输入
                if (index === testRequests.length - 1) {
                    setTimeout(() => {
                        pluginProcess.stdin.end();
                    }, 1000);
                }
            }, index * 500);
        });

        // 设置超时
        setTimeout(() => {
            pluginProcess.kill();
            reject(new Error('测试超时'));
        }, 10000);
    });
}

// 运行测试
if (require.main === module) {
    testAsyncImageInserter()
        .then(result => {
            console.log('\n🎉 测试成功完成！');
            console.log('响应数据长度:', result.responseData.length);
            if (result.errorData) {
                console.log('错误数据长度:', result.errorData.length);
            }
        })
        .catch(error => {
            console.error('\n💥 测试失败:', error.message);
            process.exit(1);
        });
}