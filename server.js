const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 获取程序运行目录
const EXEC_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
process.chdir(EXEC_DIR);

// 加载环境变量
try { require('dotenv').config(); } catch(e) {}

const PORT = process.env.PORT || 3001;

// 确保目录存在
['uploads'].forEach(d => {
  const dir = path.join(EXEC_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ========== 完整 SKILL 提示词 ==========
const SKILL_SYSTEM_PROMPT = `你是一位拥有20年野钓实战经验的资深钓鱼大师，精通全国各水域鱼情、时令规律和装备搭配。

## 任务
用户站在钓点拍照并发起分析，你将收到：
1. 钓点照片（你的任务是识别地形特征）
2. GPS经纬度坐标
3. 当前天气数据（气温、气压、湿度、风向、风速、降水量）

请按照以下完整规则进行分析，并输出标准格式的钓鱼报告。

## 季节判断
根据当前日期判断：春季(3-5月)、夏季(6-8月)、秋季(9-11月)、冬季(12-2月)。

## 地形识别
请仔细分析照片中的地形特征，尽可能识别以下特征：

### 正向特征（识别到后加分）
- 茂密水草区 — 鲫鱼+25分、鲤鱼+15分，地形+15分
- 洄水湾/河道弯道 — 鲤鱼+20分、鲫鱼+10分，地形+15分
- 铧尖/凸岸 — 所有鱼种+10分，地形+10分
- 深浅交界处/水下坎位 — 草鱼+20分、鲤鱼+15分，地形+15分
- 桥墩/树阴/水下障碍物 — 翘嘴+15分、鲫鱼+10分，地形+10分
- 入水口/出水口 — 白条+30分、翘嘴+25分，地形+20分

### 负向特征（识别到后扣分）
- 纯光面无遮挡浅滩（夏季注意）— 地形-15分
- 湍急流水区 — 地形-20分
- 深水陡崖/无缓坡 — 地形-10分，标记危险

## 天气评分规则（满分70分）

### 气压评分（满分30）
- 1010-1025hPa: +30分（极佳）
- 1005-1009hPa: +20分（良好）
- 995-1004hPa: +10分（一般）
- <995hPa: -20分（极差，建议不出钓）
- >1025hPa: +15分（偏高但稳定）

### 气温评分（满分15）
- 15-28℃: +15分（最佳）
- 5-14℃或29-32℃: +5分（一般）
- <5℃或>32℃: -10分（较差）

### 风向评分（满分15）
- 南风系（东南/南/西南）: +15分
- 东风系（东/东北）: +10分
- 西风系（西）: +5分
- 北风系（北/西北）: -10分

### 风速评分（满分10）
- 0-2级(0-19km/h): +10分（最佳）
- 3-4级(20-38km/h): +5分（一般）
- 5级及以上(>=39km/h): -15分（风浪大，建议不出钓）

## 鱼种预测规则（独立评分，排名输出）

### 季节基础分
春季: 鲫鱼90  鲤鱼75  白条60  草鱼40
夏季: 鲤鱼85  草鱼80  翘嘴70  鲫鱼60
秋季: 鲫鱼85  鲤鱼80  草鱼75  翘嘴70
冬季: 鲫鱼95  鲤鱼50  翘嘴30  白条25

### 地形修正（在上述基础分上加减，上限100分）
- 有水草区: 鲫鱼+20
- 有入水口/出水口: 翘嘴+25，白条+15
- 有深水区/坎位: 鲤鱼+20
- 有桥墩/障碍物: 翘嘴+15
- 有洄水湾: 鲤鱼+15

## 地形评分规则（满分30分）
正向加分累计上限30分，负向扣分无下限。
总扣分阈值：正向加分累计上限30分
最终地形分 = 正向加分 - 负向扣分（钳制在 -30~30）

## 钓点综合评分（总分0-100分）
总分 = 30（基础分） + 天气评分（0-70） + 地形评分（-30~30）
钳制在0-100之间。

星级：
- 80-100: ⭐⭐⭐⭐⭐ 极佳
- 60-79:  ⭐⭐⭐⭐ 良好
- 40-59:  ⭐⭐⭐ 一般
- 20-39:  ⭐⭐ 较差
- 0-19:   ⭐ 极差

## 装备推荐（按最高分鱼种推荐）
鲫鱼: 3.6m-4.5m软调手竿 | 2#-3#袖钩 | 奶香/腥香鲫鱼饵 | 酒米打窝
鲤鱼: 4.5m-5.4m综合竿 | 4#-6#伊势尼 | 螺鲤2号+九一八 | 颗粒+玉米打窝
草鱼: 5.4m-6.3m硬调竿 | 6#-8#伊势尼 | 嫩玉米/草鱼饵 | 玉米打窝
翘嘴: 4.5m路亚竿/筏竿 | 3#-4#千又 | 腥香拉饵/活虾 | 散炮打频率
白条: 2.7m-3.6m溪流竿 | 1#-2#袖钩 | 腥香拉饵 | 无需打窝钓浮

## 最佳作钓时段
春季: 早口6:00-9:00，晚口16:00-19:00
夏季(<32℃): 早口5:00-8:00，晚口17:00-20:00
夏季(>=32℃): 仅早口5:00-8:00
秋季: 早口6:00-9:00，晚口16:00-18:00
冬季: 10:00-15:00

## 输出格式（严格使用此格式）

请严格按照以下格式输出钓鱼报告，将XX替换为实际计算结果：

# 🎣 智能钓点分析报告

## 📊 钓点综合评分：XX/100 ⭐等级

> 评分明细：基础分30 + 天气XX分 + 地形XX分 = XX分

### 🌤️ 当前天气与鱼情指数
| 指标 | 数值 | 得分 | 说明 |
|------|------|------|------|
| 气压 | XXX.X hPa | +XX/30 | 开口等级：XXX |
| 气温 | XX.X℃ | +XX/15 | XXX |
| 风向 | XX风 | +XX/15 | XXX |
| 风速 | X级(XX km/h) | +XX/10 | XXX |
| 湿度 | XX% | — | 参考值 |

### 🗺️ 钓点地形分析
正向特征表格 | 负向特征表格 | 地形总分

## 🐟 预测鱼种及上鱼概率
排名 | 鱼种 | 总分 | 基础分 | 地形修正 | 备注

## 🎒 全套装备与饵料方案
按目标鱼推荐

## ⚠️ 重要注意事项
1. 最佳作钓时段
2. 安全提醒
3. 其他注意事项
`;

// ========== 图片压缩 ==========
async function compressImage(buffer) {
  let quality = 80;
  const meta = await sharp(buffer).metadata();
  if (meta.format === 'png' && meta.size < 2 * 1024 * 1024) return buffer;
  let result = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  while (result.length > 2 * 1024 * 1024 && quality > 30) {
    quality -= 10;
    result = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }
  return result;
}

// ========== 豆包 API 调用 ==========
async function callDoubaoAPI(imageBase64, userText) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.AI_MODEL || 'doubao-seed-2-0-mini-260428';

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('请先在设置中配置 API Key');
  }

  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: 'data:image/jpeg;base64,' + imageBase64 },
          { type: 'input_text', text: userText }
        ]
      }
    ]
  };

  const resp = await fetch(baseUrl + '/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('豆包 API 调用失败 (' + resp.status + '): ' + err.slice(0, 300));
  }

  const data = await resp.json();
  // Responses API 返回格式：data.output[].content[].text
  if (data.output && data.output.length > 0) {
    const msg = data.output[0];
    if (msg.content && msg.content.length > 0) {
      return msg.content.map(c => c.text || '').join('');
    }
    // 也可能是纯文本回复
    if (typeof msg === 'string') return msg;
  }
  // 备用：也可能是 data.choices 格式
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message?.content || '';
  }
  return JSON.stringify(data);
}

// ========== 启动 ==========
async function start() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static('public'));
  app.use('/uploads', express.static('uploads'));

  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png)$/)) return cb(new Error('仅支持 JPG 和 PNG 格式'));
      cb(null, true);
    }
  });

  // ========== API 路由 ==========

  // 分析钓点：拍照 + GPS + 天气 → 调用豆包
  app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: '请上传钓点照片' });

      // 压缩图片
      const compressed = await compressImage(req.file.buffer);
      const base64 = compressed.toString('base64');

      // 获取 GPS 和天气参数
      const { lat, lon, weather } = req.body;
      let weatherStr = '';
      if (weather) {
        try {
          const w = typeof weather === 'string' ? JSON.parse(weather) : weather;
          weatherStr = [
            `气温: ${w.temperature ?? '未知'}℃`,
            `气压: ${w.pressure ?? '未知'} hPa`,
            `湿度: ${w.humidity ?? '未知'}%`,
            `风向: ${w.windDirection ?? '未知'}°（${windDirText(w.windDirection)}）`,
            `风速: ${w.windSpeed ?? '未知'} km/h（${windLevelText(w.windSpeed)}级）`,
            `降水量: ${w.precipitation ?? '0'} mm`
          ].join('，');
        } catch(e) { weatherStr = '天气数据获取失败'; }
      }

      // 组装给 AI 的用户问题
      const userPrompt = `请帮我分析这个钓点。

## 位置信息
${lat && lon ? `GPS坐标：${lat}, ${lon}` : '位置：用户未提供'}

## 当前天气
${weatherStr || '天气数据未获取'}

## 当前月份
${new Date().getMonth() + 1}月

请严格按照规则输出完整的钓鱼分析报告。`;

      // 调用豆包
      const report = await callDoubaoAPI(base64, userPrompt);

      res.json({ success: true, report });
    } catch (err) {
      console.error('分析失败:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 测试 API 连接
  app.post('/api/test-connection', async (req, res) => {
    try {
      const apiKey = process.env.AI_API_KEY;
      const baseUrl = process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
      const model = process.env.AI_MODEL || 'doubao-seed-2-0-mini-260428';

      if (!apiKey || apiKey === 'your-api-key-here') {
        return res.json({ success: false, error: '未配置 API Key' });
      }

      const resp = await fetch(baseUrl + '/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model,
          input: [{ role: 'user', content: [{ type: 'input_text', text: '请回复"连接成功"' }] }]
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (resp.ok) {
        res.json({ success: true, model });
      } else {
        const err = await resp.text();
        res.json({ success: false, error: err.slice(0, 200) });
      }
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });

  // 获取当前设置
  app.get('/api/settings', (req, res) => {
    const envPath = '.env';
    const config = {};
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
        if (m) config[m[1]] = m[2];
      });
    }
    const key = config.AI_API_KEY || '';
    res.json({
      apiKey: key.length > 8 ? key.slice(0, 4) + '****' + key.slice(-4) : key,
      hasKey: !!key && key !== 'your-api-key-here',
      baseUrl: config.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: config.AI_MODEL || 'doubao-seed-2-0-mini-260428'
    });
  });

  // 保存设置
  app.post('/api/settings', (req, res) => {
    try {
      const { apiKey, baseUrl, model } = req.body;
      const envPath = '.env';
      let content = '';
      if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf-8');

      const setOrReplace = (key, value) => {
        const regex = new RegExp('^' + key + '\\s*=\\s*.*$', 'm');
        content = regex.test(content)
          ? content.replace(regex, key + '=' + value)
          : content + '\n' + key + '=' + value;
      };

      if (apiKey && !apiKey.includes('****')) setOrReplace('AI_API_KEY', apiKey);
      if (baseUrl) setOrReplace('AI_BASE_URL', baseUrl);
      if (model) setOrReplace('AI_MODEL', model);

      fs.writeFileSync(envPath, content.trim() + '\n', 'utf-8');

      if (apiKey && !apiKey.includes('****')) process.env.AI_API_KEY = apiKey;
      if (baseUrl) process.env.AI_BASE_URL = baseUrl;
      if (model) process.env.AI_MODEL = model;

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== 辅助函数 ==========
  function windDirText(deg) {
    if (deg === undefined || deg === null) return '未知';
    if (deg < 22.5 || deg >= 337.5) return '北风';
    if (deg < 67.5) return '东北风';
    if (deg < 112.5) return '东风';
    if (deg < 157.5) return '东南风';
    if (deg < 202.5) return '南风';
    if (deg < 247.5) return '西南风';
    if (deg < 292.5) return '西风';
    return '西北风';
  }

  function windLevelText(speed) {
    if (speed === undefined || speed === null) return '0';
    if (speed <= 5) return '0';
    if (speed <= 11) return '1';
    if (speed <= 19) return '2';
    if (speed <= 28) return '3';
    if (speed <= 38) return '4';
    if (speed <= 49) return '5';
    if (speed <= 61) return '6';
    return '7+';
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ┌──────────────────────────────────────┐');
    console.log('  │       🎣  AI钓点鱼情预测 已启动      │');
    console.log('  │       http://localhost:' + PORT + '           │');
    console.log('  └──────────────────────────────────────┘');
    console.log('');
  });
}

start().catch(err => { console.error('启动失败:', err); process.exit(1); });
