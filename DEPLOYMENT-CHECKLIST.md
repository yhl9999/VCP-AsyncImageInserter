# AsyncImageInserter 部署检查清单

## ✅ **已完成的配置**

### 1. 插件核心文件
- [x] **AsyncImageInserter.js** - 主插件逻辑
- [x] **agentProxy.js** - Agent通信代理  
- [x] **placeholderManager.js** - 占位符管理器
- [x] **plugin-manifest.json** - 插件配置清单
- [x] **config.env** - 运行时配置
- [x] **test.js** - 测试脚本

### 2. Agent配置
- [x] **ImageGenerator.txt** - 专业图片生成Agent配置文件
  - 位置: `d:\vcp\VCPToolBox\Agent\ImageGenerator.txt`

### 3. VCPChat前端集成
- [x] **AsyncImageModules/async-image-processor.js** - 消息预处理器
- [x] **AsyncImageModules/placeholder-replacer.js** - 占位符替换器  
- [x] **AsyncImageModules/websocket-server.js** - WebSocket集成
- [x] **AsyncImageModules/integration.js** - 统一集成接口
- [x] **AsyncImageModules/async-image.css** - 样式文件

### 4. WebSocket服务器更新
- [x] **VCPToolBox/WebSocketServer.js** - 添加AsyncImage路径支持
  - 路径: `/vcp-async-image/VCP_Key=<key>`
  - 客户端类型: `AsyncImage`
  - 广播函数: `broadcastToAsyncImageClients()`

### 5. 工具注册
- [x] **supertool.txt** - 在VCP工具列表中注册AsyncImageInserter
  - 工具名: `AsyncImageInserter`
  - 参数: prompt, service, width, height, priority

### 6. 文档和指南
- [x] **README.md** - 完整的v3.0技术文档
- [x] **INSTALL.md** - 安装部署指南
- [x] **WebSocket-Updates/README.md** - WebSocket更新指南

## 🔧 **自动发现机制**

### 插件发现
VCPToolBox通过以下机制自动发现插件：
- **目录扫描**: 扫描 `d:\vcp\VCPToolBox\Plugin\` 目录
- **清单识别**: 查找 `plugin-manifest.json` 文件
- **自动加载**: 根据 `pluginType` 和 `entryPoint` 加载插件

### Agent发现
VCPToolBox通过以下机制发现Agent：
- **目录扫描**: 扫描 `d:\vcp\VCPToolBox\Agent\` 目录
- **文件匹配**: 查找 `.txt` 格式的Agent配置文件
- **自动注册**: 根据文件名注册Agent

## 🚀 **部署验证步骤**

### 1. 重启VCPToolBox服务器
```bash
# 重启VCPToolBox以加载新插件
pm2 restart vcp-toolbox
# 或者
node server.js
```

### 2. 检查插件加载日志
在VCPToolBox启动日志中应该看到：
```
[PluginManager] Loading plugin: AsyncImageInserter
[PluginManager] Plugin AsyncImageInserter loaded successfully
[WebSocketServer] AsyncImage WebSocket path registered
```

### 3. 测试插件功能
```bash
cd d:\vcp\VCPToolBox\Plugin\AsyncImageInserter
node test.js
```

### 4. 验证Agent调用
使用AgentAssistant调用ImageGenerator：
```
<<<[TOOL_REQUEST]>>>
maid:「始」测试「末」,
tool_name:「始」AgentAssistant「末」,
agent_name:「始」ImageGenerator「末」,
prompt:「始」请生成一张雪山日出的图片「末」
<<<[END_TOOL_REQUEST]>>>
```

### 5. 测试WebSocket连接
在VCPChat中检查WebSocket连接：
- 连接地址: `ws://localhost:6005/vcp-async-image/VCP_Key=<key>`
- 预期响应: `{"type":"connection_ack","message":"AsyncImage WebSocket connection successful."}`

## ⚠️ **注意事项**

### 必要的依赖检查
- [x] **Node.js** - 确保版本支持ES6+
- [x] **VCPToolBox** - 确保WebSocket服务器支持AsyncImage路径
- [x] **图片生成插件** - 至少一个可用（ComfyUIGen/FluxGen/NovelAIGen）

### 配置文件检查
- [x] **config.env** - 确保IMAGE_GENERATOR_AGENT_ID=ImageGenerator
- [x] **VCP_Key** - 确保WebSocket认证密钥正确配置

### 网络端口检查
- [x] **端口6005** - VCPToolBox主服务端口，包含WebSocket服务
- [x] **ImageServer** - 用于图片文件访问的HTTP服务

## 🎯 **完成状态**

**AsyncImageInserter v3.0** 已完全部署就绪！

所有核心组件、配置文件、文档和集成都已完成。插件现在可以：
- ✅ 接收异步图片生成请求
- ✅ 调用ImageGenerator Agent
- ✅ 通过WebSocket实时推送更新
- ✅ 在VCPChat中精确替换占位符
- ✅ 支持多服务并发生成

**下一步：重启VCPToolBox服务器，插件将自动生效！** 🚀