# 安装指南

## 🚀 快速安装

### 1. 插件安装
将此仓库的内容复制到你的VCPToolBox插件目录：
```bash
git clone https://github.com/yhl9999/VCP-AsyncImageInserter.git
cp -r VCP-AsyncImageInserter/* /path/to/VCPToolBox/Plugin/AsyncImageInserter/
```

### 2. 配置文件
```bash
cd /path/to/VCPToolBox/Plugin/AsyncImageInserter/
cp config.env.example config.env
# 根据需要修改 config.env 中的配置
```

### 3. Agent配置
将 `ImageGenerator.txt` 复制到Agent目录：
```bash
cp ImageGenerator.txt /path/to/VCPToolBox/Agent/
```

### 4. VCPChat集成
将 `VCPChat-Integration/` 目录下的文件复制到对应位置：
```bash
cp -r VCPChat-Integration/AsyncImageModules /path/to/VCPChat/
```

### 5. WebSocket服务器更新
如果你的VCPToolBox版本较老，需要更新WebSocket服务器以支持AsyncImage：
```bash
# 备份原文件
cp /path/to/VCPToolBox/WebSocketServer.js /path/to/VCPToolBox/WebSocketServer.js.backup

# 应用补丁或手动更新
# 参考 WebSocket-Updates/ 目录下的补丁文件
```

## 🔧 验证安装

### 测试插件功能
```bash
cd /path/to/VCPToolBox/Plugin/AsyncImageInserter/
node test.js
```

### 检查WebSocket连接
在VCPChat中测试AsyncImage功能，查看控制台是否有WebSocket连接成功的日志。

## 📝 配置说明

详细配置选项请参考 [README.md](README.md) 中的配置章节。

## ❗ 注意事项

1. 确保VCPToolBox版本支持AsyncImage WebSocket路径
2. ImageGenerator Agent需要相应的图片生成插件（ComfyUIGen/FluxGen/NovelAIGen）
3. 检查端口6005是否可用且未被占用