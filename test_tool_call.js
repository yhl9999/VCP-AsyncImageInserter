/**
 * VCP工具调用流程测试
 * 验证AsyncImageInserter是否能正确接收AI的调用
 */

const fs = require('fs');
const path = require('path');

// 模拟VCP解析逻辑
function parseVCPToolRequest(aiResponse) {
    const toolRequestStartMarker = "<<<[TOOL_REQUEST]>>>";
    const toolRequestEndMarker = "<<<[END_TOOL_REQUEST]>>>";
    let toolCalls = [];
    let searchOffset = 0;

    while (searchOffset < aiResponse.length) {
        const startIndex = aiResponse.indexOf(toolRequestStartMarker, searchOffset);
        if (startIndex === -1) break;

        const endIndex = aiResponse.indexOf(toolRequestEndMarker, startIndex + toolRequestStartMarker.length);
        if (endIndex === -1) {
            console.warn("Found TOOL_REQUEST_START but no END marker");
            break;
        }

        const requestBlockContent = aiResponse.substring(startIndex + toolRequestStartMarker.length, endIndex).trim();
        let parsedToolArgs = {};
        let requestedToolName = null;
        
        // 使用与VCP相同的正则表达式
        const paramRegex = /([\w_]+)\s*:\s*「始」([\s\S]*?)「末」\s*(?:,)?/g;
        let regexMatch;
        
        while ((regexMatch = paramRegex.exec(requestBlockContent)) !== null) {
            const key = regexMatch[1];
            const value = regexMatch[2].trim();
            if (key === "tool_name") requestedToolName = value;
            else parsedToolArgs[key] = value;
        }

        if (requestedToolName) {
            toolCalls.push({ name: requestedToolName, args: parsedToolArgs });
        }
        
        searchOffset = endIndex + toolRequestEndMarker.length;
    }

    return toolCalls;
}

async function testToolCallFlow() {
    console.log('=== VCP工具调用流程测试 ===\n');

    // 测试1: 模拟Nova.txt中的调用格式
    console.log('1. 测试Nova.txt格式的工具调用...');
    const novaFormatRequest = `我来为你生成一张图片：

<<<[TOOL_REQUEST]>>>
tool_name:「始」AsyncImageInserter「末」,
prompt:「始」一只可爱的小猫在阳光下睡觉「末」,
service:「始」ComfyUI「末」
<<<[END_TOOL_REQUEST]>>>

请稍等，图片正在生成中...`;

    const parsedCalls = parseVCPToolRequest(novaFormatRequest);
    console.log('解析结果:', JSON.stringify(parsedCalls, null, 2));
    
    if (parsedCalls.length === 0) {
        console.error('❌ 未能解析出工具调用');
        return false;
    }
    
    const call = parsedCalls[0];
    if (call.name !== 'AsyncImageInserter') {
        console.error(`❌ 工具名解析错误，期望: AsyncImageInserter, 实际: ${call.name}`);
        return false;
    }
    
    if (!call.args.prompt || call.args.prompt !== '一只可爱的小猫在阳光下睡觉') {
        console.error(`❌ prompt参数解析错误，实际: ${call.args.prompt}`);
        return false;
    }
    
    console.log('✅ Nova格式解析成功');

    // 测试2: 验证参数传递
    console.log('\n2. 测试参数传递...');
    const { AsyncImageInserter } = require('./AsyncImageInserter');
    const inserter = new AsyncImageInserter();
    
    try {
        const result = await inserter.processRequest(call.args);
        console.log('插件处理结果:', result);
        
        if (result.status !== 'success') {
            console.error(`❌ 插件处理失败: ${result.error}`);
            return false;
        }
        
        if (!result.result || !result.result.includes('ASYNC_IMG')) {
            console.error(`❌ 未返回正确的占位符: ${result.result}`);
            return false;
        }
        
        console.log('✅ 插件处理成功');
        
    } catch (error) {
        console.error(`❌ 插件调用异常: ${error.message}`);
        return false;
    }

    console.log('\n✅ 工具调用流程测试通过！');
    return true;
}

// 运行测试
if (require.main === module) {
    testToolCallFlow().then(success => {
        console.log(`\n=== 测试结果: ${success ? '成功' : '失败'} ===`);
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('测试异常:', error);
        process.exit(1);
    });
}

module.exports = { testToolCallFlow, parseVCPToolRequest };