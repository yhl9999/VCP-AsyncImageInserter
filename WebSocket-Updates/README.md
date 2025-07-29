# WebSocket服务器更新说明

## 📝 概述
为了支持AsyncImageInserter插件，需要对VCPToolBox的WebSocket服务器进行更新，添加AsyncImage客户端类型的支持。

## 🔧 手动更新步骤

### 1. 备份原文件
```bash
cp /path/to/VCPToolBox/WebSocketServer.js /path/to/VCPToolBox/WebSocketServer.js.backup
```

### 2. 修改内容

#### 在客户端存储部分添加（约第12-18行）：
```javascript
// 用于存储不同类型的客户端
const clients = new Map(); // VCPLog 等普通客户端
const distributedServers = new Map(); // 分布式服务器客户端
const chromeControlClients = new Map(); // ChromeControl 客户端
const chromeObserverClients = new Map(); // 新增：ChromeObserver 客户端
const asyncImageClients = new Map(); // 新增：AsyncImage 客户端  ← 添加这行
const pendingToolRequests = new Map(); // 跨服务器工具调用的待处理请求
```

#### 在路径匹配部分添加（约第49-53行）：
```javascript
const vcpLogPathRegex = /^\/VCPlog\/VCP_Key=(.+)$/;
const distServerPathRegex = /^\/vcp-distributed-server\/VCP_Key=(.+)$/;
const chromeControlPathRegex = /^\/vcp-chrome-control\/VCP_Key=(.+)$/;
const chromeObserverPathRegex = /^\/vcp-chrome-observer\/VCP_Key=(.+)$/;
const asyncImagePathRegex = /^\/vcp-async-image\/VCP_Key=(.+)$/; ← 添加这行
```

#### 在路径匹配执行部分添加（约第55-59行）：
```javascript
const vcpMatch = pathname.match(vcpLogPathRegex);
const distMatch = pathname.match(distServerPathRegex);
const chromeControlMatch = pathname.match(chromeControlPathRegex);
const chromeObserverMatch = pathname.match(chromeObserverPathRegex);
const asyncImageMatch = pathname.match(asyncImagePathRegex); ← 添加这行
```

#### 在客户端类型判断部分添加（约第81-85行）：
```javascript
} else if (chromeControlMatch && chromeControlMatch[1]) {
   clientType = 'ChromeControl';
   connectionKey = chromeControlMatch[1];
   writeLog(`Temporary ChromeControl client attempting to connect.`);
} else if (asyncImageMatch && asyncImageMatch[1]) {     ← 添加这个分支
   clientType = 'AsyncImage';
   connectionKey = asyncImageMatch[1];
   writeLog(`AsyncImage client attempting to connect.`);
} else {
```

#### 在客户端连接处理部分添加（约第126-138行）：
```javascript
} else if (clientType === 'ChromeControl') {
   chromeControlClients.set(clientId, ws);
   writeLog(`Temporary ChromeControl client ${clientId} connected.`);
} else if (clientType === 'AsyncImage') {                    ← 添加这个分支
   asyncImageClients.set(clientId, ws);
   writeLog(`AsyncImage client ${clientId} connected and stored.`);
   
   // 获取AsyncImage模块（如果有的话）
   const asyncImageModule = pluginManager ? pluginManager.getServiceModule('AsyncImageInserter') : null;
   if (asyncImageModule && typeof asyncImageModule.handleNewClient === 'function') {
       writeLog(`AsyncImage module found. Calling handleNewClient...`);
       asyncImageModule.handleNewClient(ws);
   } else {
       writeLog(`AsyncImage client connected, but AsyncImageInserter module not found or handleNewClient is missing.`);
   }
} else {
```

#### 在连接确认消息部分添加（约第156-158行）：
```javascript
// 发送连接确认消息给特定类型的客户端
if (ws.clientType === 'VCPLog') {
    ws.send(JSON.stringify({ type: 'connection_ack', message: 'WebSocket connection successful for VCPLog.' }));
} else if (ws.clientType === 'AsyncImage') {              ← 添加这个分支
    ws.send(JSON.stringify({ type: 'connection_ack', message: 'AsyncImage WebSocket connection successful.' }));
}
```

#### 在断开连接清理部分添加（约第241-244行）：
```javascript
} else if (ws.clientType === 'ChromeControl') {
  chromeControlClients.delete(ws.clientId);
  writeLog(`ChromeControl client ${ws.clientId} disconnected and removed.`);
} else if (ws.clientType === 'AsyncImage') {              ← 添加这个分支
  asyncImageClients.delete(ws.clientId);
  writeLog(`AsyncImage client ${ws.clientId} disconnected and removed.`);
} else {
```

#### 在模块导出部分添加（约第415-424行）：
在 `module.exports` 中添加以下函数：

```javascript
/**
 * 向所有AsyncImage客户端广播消息
 * @param {Object} message - 要广播的消息
 */
function broadcastToAsyncImageClients(message) {
    const messageString = JSON.stringify(message);
    let sentCount = 0;
    
    asyncImageClients.forEach((ws, clientId) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(messageString);
            sentCount++;
        }
    });
    
    writeLog(`Broadcast message to ${sentCount} AsyncImage clients: ${message.type}`);
}

/**
 * 获取AsyncImage客户端数量
 * @returns {number} 连接的AsyncImage客户端数量
 */
function getAsyncImageClientCount() {
    return asyncImageClients.size;
}

module.exports = {
    initialize,
    setPluginManager,
    broadcast,
    sendMessageToClient,
    executeDistributedTool,
    broadcastToAsyncImageClients,     ← 添加这行
    getAsyncImageClientCount,         ← 添加这行
    shutdown
};
```

## ✅ 验证更新

更新完成后，重启VCPToolBox服务器，在日志中应该能看到：
```
[WebSocketServer] AsyncImage client attempting to connect.
[WebSocketServer] AsyncImage client [clientId] connected and stored.
```

## 🔄 版本兼容性

此更新向后兼容，不会影响现有的WebSocket客户端（VCPLog、ChromeObserver等）。