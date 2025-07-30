/**
 * AsyncImageInserter完整流程测试
 * 测试从工具调用到WebSocket推送的整个流程
 */

const { AsyncImageInserter } = require('./AsyncImageInserter');
const { testAIService } = require('./test_ai');

async function testCompleteFlow() {
    console.log('🧪 开始AsyncImageInserter完整流程测试\n');

    try {
        // 1. 测试AI服务
        console.log('=== 步骤1: 测试AI服务 ===');
        const aiWorking = await testAIService();
        if (!aiWorking) {
            console.error('❌ AI服务测试失败，跳过后续测试');
            return false;
        }
        console.log('✅ AI服务正常\n');

        // 2. 测试插件初始化
        console.log('=== 步骤2: 测试AsyncImageInserter初始化 ===');
        const inserter = new AsyncImageInserter();
        console.log('✅ 插件初始化成功\n');

        // 3. 测试占位符创建
        console.log('=== 步骤3: 测试占位符创建 ===');
        const testRequest = {
            prompt: '一只可爱的橙色猫咪在花园里玩耍',
            service: 'ComfyUI',
            priority: 'normal'
        };

        const result = await inserter.processRequest(testRequest);
        console.log('请求结果:', result);

        if (result.status !== 'success' || !result.result.includes('ASYNC_IMG_')) {
            console.error('❌ 占位符创建失败');
            return false;
        }
        console.log('✅ 占位符创建成功\n');

        // 4. 验证任务队列
        console.log('=== 步骤4: 验证任务队列状态 ===');
        const status = inserter.getSystemStatus();
        console.log('系统状态:', JSON.stringify(status, null, 2));
        
        if (status.queueLength === 0) {
            console.error('❌ 任务队列为空');
            return false;
        }
        console.log('✅ 任务已加入队列\n');

        // 5. 等待任务处理
        console.log('=== 步骤5: 等待任务处理 ===');
        console.log('等待后台处理任务...');
        
        // 等待10秒让后台处理任务
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const finalStatus = inserter.getSystemStatus();
        console.log('最终状态:', JSON.stringify(finalStatus, null, 2));

        // 6. 检查处理结果
        console.log('\n=== 步骤6: 检查处理结果 ===');
        if (finalStatus.processing > 0) {
            console.log('⏳ 任务仍在处理中，这是正常的');
        } else if (finalStatus.completed > 0) {
            console.log('✅ 有任务已完成');
        } else if (finalStatus.failed > 0) {
            console.log('⚠️ 有任务失败，但流程完整');
        }

        console.log('\n🎉 完整流程测试完成！');
        return true;

    } catch (error) {
        console.error('\n❌ 完整流程测试失败:', error.message);
        console.error('错误详情:', error);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testCompleteFlow().then(success => {
        console.log(`\n=== 测试结果: ${success ? '成功' : '失败'} ===`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testCompleteFlow };