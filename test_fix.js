// 测试修复后的JSON格式
const testData = {
    "model": "gemini-2.5-flash",
    "messages": [
        {
            "role": "system", 
            "content": "你是专业的图片生成提示词优化专家。任务：将中文或英文描述转换为高质量的英文图片生成提示词。要求：1. 只输出优化后的英文提示词 2. 不要包含解释或说明 3. 包含必要的风格和质量描述 4. 适合AI图片生成模型使用"
        },
        {
            "role": "user",
            "content": "请将以下描述转换为适合ComfyUI的英文提示词：一只可爱的小猫在阳光下睡觉。风格：写实摄影风格，包含详细描述。"
        }
    ],
    "stream": false,
    "max_tokens": 500,
    "temperature": 0.7
};

console.log("正确的JSON格式:");
console.log(JSON.stringify(testData, null, 2));