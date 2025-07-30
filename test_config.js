/**
 * 测试VCP配置加载
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载VCP的配置文件
const vcpConfigPath = path.join(__dirname, '../../config.env');
console.log('VCP配置文件路径:', vcpConfigPath);
console.log('配置文件是否存在:', fs.existsSync(vcpConfigPath));

if (fs.existsSync(vcpConfigPath)) {
    dotenv.config({ path: vcpConfigPath });
    console.log('配置加载完成');
} else {
    console.log('配置文件不存在，使用默认环境变量');
}

console.log('API配置:');
console.log('- API_URL:', process.env.API_URL);
console.log('- API_Key:', process.env.API_Key ? '已设置' : '未设置');

// 测试AI客户端
const AIClient = require('./aiClient');

try {
    const aiClient = new AIClient({ debugMode: true });
    console.log('\n✅ AIClient初始化成功');
    
    // 测试简单请求
    aiClient.sendChatRequest([
        { role: 'user', content: '测试' }
    ], { max_tokens: 10 }).then(response => {
        console.log('AI响应:', response);
    }).catch(error => {
        console.error('AI请求失败:', error.message);
    });
    
} catch (error) {
    console.error('❌ AIClient初始化失败:', error.message);
}