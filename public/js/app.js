// ========== 页面路由 ==========
let currentPage = 'home';
let photoData = null;     // 拍照数据 { dataUrl }
let locationData = null;  // GPS { lat, lon }
let weatherData = null;   // 天气
let lastReport = null;    // 上次分析结果

// ========== 配置 ==========
const DEFAULT_API_KEY = 'ark-f34f6f79-0340-47b0-b9cc-19fc669c0d51-e4e8b';
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seed-2-0-mini-260428';

function getConfig() {
  try {
    const saved = localStorage.getItem('ai_config');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { apiKey: DEFAULT_API_KEY, baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL };
}

function saveConfig(config) {
  localStorage.setItem('ai_config', JSON.stringify(config));
}

const pages = {
  home: renderHome,
  history: renderHistory,
  settings: renderSettings
};

// ========== DOM 引用 ==========
const pc = document.getElementById('pageContainer');
const nt = document.getElementById('navTabs');
const te = document.getElementById('toast');
const lo = document.getElementById('loadingOverlay');
const lt = document.getElementById('loadingText');

// ========== 导航 ==========
nt.addEventListener('click', (e) => {
  const tab = e.target.closest('.nav-tab');
  if (!tab || tab.dataset.page === currentPage) return;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentPage = tab.dataset.page;
  if (currentPage === 'home') renderHome(true);
  else pages[currentPage]();
});

// ========== Toast ==========
function st(msg, dur) {
  te.textContent = msg;
  te.classList.add('show');
  clearTimeout(te._t);
  te._t = setTimeout(() => te.classList.remove('show'), dur || 2500);
}

// ========== Loading ==========
function sl(text) { lt.textContent = text || '处理中...'; lo.style.display = 'flex'; }
function hl() { lo.style.display = 'none'; }

// ========== 压缩图片 ==========
async function compressImage(dataUrl, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      maxW = maxW || 1024; maxH = maxH || 1024;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      if (h > maxH) { w = w * maxH / h; h = maxH; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality || 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ========== 获取定位 ==========
async function getLocation() {
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 30000
      }));
      locationData = { lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) };
      return locationData;
    } catch(e) { console.log('定位失败:', e.message); }
  }
  try {
    const pos = await Capacitor.Plugins.Geolocation.getCurrentPosition();
    locationData = { lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) };
    return locationData;
  } catch(e) { console.log('Capacitor定位失败:', e.message); }
  locationData = null;
  return null;
}

// ========== 获取天气 ==========
async function getWeather(lat, lon) {
  try {
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto';
    const r = await fetch(u);
    if (!r.ok) throw new Error('天气API ' + r.status);
    const d = await r.json();
    const c = d.current;
    weatherData = {
      temperature: c.temperature_2m, humidity: c.relative_humidity_2m,
      pressure: c.surface_pressure, windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m, precipitation: c.precipitation
    };
    return weatherData;
  } catch(e) { console.error('天气失败:', e); weatherData = null; return null; }
}

// ========== 获取水域名称 ==========
let waterBodyData = null;

async function getWaterBodyName(lat, lon) {
  try {
    // Nominatim reverse geocoding, zoom=13 for water body resolution
    const u = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=13&accept-language=zh';
    const r = await fetch(u, { headers: { 'User-Agent': 'AIDiaodian/1.0' } });
    if (!r.ok) throw new Error('Nominatim ' + r.status);
    const d = await r.json();
    
    let name = null;
    // Try to extract water body name from address
    if (d.address) {
      // Priority: water > river > lake > reservoir > sea > bay > stream > canal > pond
      const waterPriority = ['water', 'river', 'lake', 'reservoir', 'sea', 'bay', 'stream', 'canal', 'pond', 'brook'];
      for (const key of waterPriority) {
        if (d.address[key]) {
          name = d.address[key];
          break;
        }
      }
    }
    
    // Also use display_name for context (省市区+水域)
    const fullName = d.display_name || null;
    
    waterBodyData = {
      name: name,
      fullName: fullName,
      raw: d
    };
    
    return waterBodyData;
  } catch(e) {
    console.log('水域查询失败:', e.message);
    waterBodyData = null;
    return null;
  }
}

// ========== 辅助 ==========
function wd(deg) {
  if (deg === undefined || deg === null) return '-';
  if (deg < 22.5 || deg >= 337.5) return '北风';
  if (deg < 67.5) return '东北风'; if (deg < 112.5) return '东风';
  if (deg < 157.5) return '东南风'; if (deg < 202.5) return '南风';
  if (deg < 247.5) return '西南风'; if (deg < 292.5) return '西风';
  return '西北风';
}

function wl(speed) {
  if (speed === undefined || speed === null) return '0';
  if (speed <= 5) return '0'; if (speed <= 11) return '1'; if (speed <= 19) return '2';
  if (speed <= 28) return '3'; if (speed <= 38) return '4'; if (speed <= 49) return '5';
  if (speed <= 61) return '6'; return '7+';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ========== 记录管理 ==========
function getRecords() {
  try {
    return JSON.parse(localStorage.getItem('ai_records') || '[]');
  } catch(e) { return []; }
}

function saveRecord(record) {
  record.id = Date.now();
  record.date = new Date().toLocaleString('zh-CN');

  // Keep trying: if quota exceeded, remove oldest records and retry
  let records = getRecords();
  records.unshift(record);

  while (records.length > 0) {
    try {
      localStorage.setItem('ai_records', JSON.stringify(records));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        // Remove oldest record to free space
        records.pop();
      } else {
        st('保存失败: ' + e.message, 3000);
        return false;
      }
    }
  }

  st('存储空间不足，无法保存', 3000);
  return false;
}

// Generate a tiny thumbnail (~10KB) for storage instead of full photo (~500KB)
async function makeThumbnail(dataUrl, maxW, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      maxW = maxW || 160;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      if (h > maxW) { w = w * maxW / h; h = maxW; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality || 0.35));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function deleteRecord(id) {
  const records = getRecords().filter(r => r.id !== id);
  localStorage.setItem('ai_records', JSON.stringify(records));
  st('已删除');
  renderHistory();
}

// ========== 调用豆包 API ==========
async function callDoubao(imageBase64, userText) {
  const cfg = getConfig();
  const apiKey = cfg.apiKey || DEFAULT_API_KEY;
  const baseUrl = cfg.baseUrl || DEFAULT_BASE_URL;
  const model = cfg.model || DEFAULT_MODEL;

  const body = {
    model,
    input: [{
      role: 'user',
      content: [
        { type: 'input_image', image_url: imageBase64 },
        { type: 'input_text', text: userText }
      ]
    }]
  };

  const resp = await fetch(baseUrl + '/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('豆包API错误 (' + resp.status + '): ' + err.slice(0, 200));
  }

  const data = await resp.json();
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content && Array.isArray(item.content)) {
        return item.content.map(c => c.text || c.output_text || '').join('');
      }
    }
    const msg = data.output.find(o => o.content);
    if (msg && msg.content) return msg.content.map(c => c.text || c.output_text || '').join('');
  }
  if (data.choices && data.choices[0]) return data.choices[0].message?.content || '';
  if (data.result) return data.result;
  if (data.text) return data.text;
  return JSON.stringify(data);
}

// ========== 组装提示词（结构化输出） ==========
function buildPrompt() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dateStr = now.toISOString().slice(0, 10);

  const parts = [];
  parts.push('请帮我分析这个钓点。请严格按照以下结构输出报告：\n');
  parts.push('## 日期\n' + dateStr + '（' + month + '月）\n');

  if (locationData) {
    parts.push('## 位置信息\nGPS坐标：' + locationData.lat + ', ' + locationData.lon + '\n');
  }

  if (weatherData) {
    const w = weatherData;
    parts.push('## 当前天气');
    parts.push([
      '气温: ' + w.temperature + '℃',
      '气压: ' + w.pressure + ' hPa',
      '湿度: ' + w.humidity + '%',
      '风向: ' + w.windDirection + '\u00b0（' + wd(w.windDirection) + '）',
      '风速: ' + w.windSpeed + ' km/h（' + wl(w.windSpeed) + '级）',
      '降水量: ' + (w.precipitation || '0') + ' mm'
    ].join('，'));
    parts.push('');
  }

  if (waterBodyData && waterBodyData.name) {
    parts.push('## 水域信息');
    parts.push('定位水域：' + waterBodyData.name);
    if (waterBodyData.fullName) {
      parts.push('详细位置：' + waterBodyData.fullName);
    }
    parts.push('请结合该水域的鱼类资源和鱼情特点进行分析。\n');
  }

  parts.push(`## 输出格式要求（严格按此结构）

**综合评分：X/10**
一句话概括这个钓点的整体鱼情。

---

### 🌤️ 天气评分：X/10

详细说明天气对钓鱼的影响，包括：
- 气压分析（气压趋势对鱼活性的影响）
- 气温分析（当前水温推测及对鱼种的影响）
- 风向风力分析（对作钓位置和方式的建议）
- 天气综合建议

### 🏞️ 地形评分：X/10

根据照片分析地形特征，包括：
- 水域类型识别（河流/湖泊/水库/池塘等）
- 岸线特征（陡坡/缓坡/草滩/石滩等）
- 适合的钓位推荐
- 地形综合评价

### ⏰ 作钓时间推荐

- **最佳时段**：具体时间段
- **时间评分**：X/10
- **时段理由**：为什么这个时段最佳

### 🐟 鱼种预测（按可能性排序）

对每种可能的鱼种：
| 鱼种 | 可能性 | 预期尺寸 | 推荐钓法 | 推荐装备 | 推荐饵料 |
|------|--------|---------|---------|---------|---------|
| XX | 高/中/低 | XX cm | 台钓/路亚等 | 竿型+线组 | 饵料类型 |

### 🎣 综合作钓建议

简要总结：
1. 推荐钓位
2. 推荐装备组合
3. 注意事项

---

请开始分析：`);

  return parts.join('\n');
}

// ========== 主页 ==========
function renderHome(resetPhoto) {
  if (resetPhoto) photoData = null;
  let html = `
    <div class="home-card">
      <h2>📸 拍摄钓点</h2>
      <div class="photo-area" id="photoArea" onclick="takePhoto()">
        ${photoData ? `<img src="${photoData.dataUrl}" alt="钓点">` : `
          <div class="photo-placeholder">📷</div>
          <div class="photo-text">点击拍照或选择照片</div>
        `}
      </div>
    </div>
    <div class="home-card">
      <h2>📍 定位信息</h2>
      <div class="location-info" id="locInfo">
        <span class="icon">📍</span>
        <span>${locationData ? '已定位: ' + locationData.lat + ', ' + locationData.lon : '正在获取位置...'}</span>
      </div>
    </div>
    <div class="home-card" id="weatherCard" style="${weatherData ? '' : 'display:none'}">
      <h2>🌤️ 当前天气</h2>
      ${weatherCardContent()}
    </div>
    <button class="btn-analyze" id="btnAnalyze" onclick="startAnalyze()" ${photoData ? '' : 'disabled'}>
      🎣 开始分析钓点
    </button>
  `;

  if (lastReport) {
    html += reportCardHtml(lastReport);
  }

  pc.innerHTML = html;
  if (!locationData) autoGetLocation();
}

function weatherCardContent() {
  if (!weatherData) return '';
  const w = weatherData;
  return `<div class="weather-info">
    <div class="weather-grid">
      <div class="weather-item">🌡️ ${w.temperature}℃</div>
      <div class="weather-item">💧 ${w.humidity}%</div>
      <div class="weather-item">🌀 ${w.pressure} hPa</div>
      <div class="weather-item">🌬️ ${w.windSpeed} km/h</div>
      <div class="weather-item">🧭 ${wd(w.windDirection)}</div>
      <div class="weather-item">🌧️ ${(w.precipitation || '0')} mm</div>
    </div>
  </div>`;
}

async function autoGetLocation() {
  const el = document.getElementById('locInfo');
  if (el) el.innerHTML = '<span class="icon">📍</span><span>正在获取定位...</span>';
  const loc = await getLocation();
  if (loc) {
    if (el) el.innerHTML = '<span class="icon">📍</span><span>已定位: ' + loc.lat + ', ' + loc.lon + '</span>';
    const w = await getWeather(loc.lat, loc.lon);
    if (w) {
      const wc = document.getElementById('weatherCard');
      if (wc) { wc.style.display = 'block'; wc.innerHTML = '<h2>🌤️ 当前天气</h2>' + weatherCardContent(); }
    }
    // 异步查询水域名称（不阻塞UI）
    getWaterBodyName(loc.lat, loc.lon);
  } else {
    if (el) el.innerHTML = '<span class="icon">⚠️</span><span>定位失败，请在设置中手动配置</span>';
  }
}

// ========== 拍照 ==========
async function takePhoto() {
  try {
    const img = await Capacitor.Plugins.Camera.getPhoto({
      quality: 80, resultType: 'DataUrl', saveToGallery: false
    });
    photoData = { dataUrl: img.dataUrl };
    updatePhotoUI();
    document.getElementById('btnAnalyze').disabled = false;
    return;
  } catch(e) { /* 降级到文件输入 */ }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      photoData = { dataUrl: ev.target.result };
      updatePhotoUI();
      document.getElementById('btnAnalyze').disabled = false;
    };
    r.readAsDataURL(f);
  };
  input.click();
}

function updatePhotoUI() {
  const area = document.getElementById('photoArea');
  if (area && photoData) {
    area.classList.add('has-image');
    area.innerHTML = `<img src="${photoData.dataUrl}" alt="钓点照片">`;
  }
}

// ========== 分析 ==========
async function startAnalyze() {
  if (!photoData) { st('请先拍摄钓点照片'); return; }
  sl('正在分析钓点...🏃');
  try {
    // 如果还没获取水域信息，立即查询
    if (!waterBodyData && locationData) {
      getWaterBodyName(locationData.lat, locationData.lon);
    }
    const compressed = await compressImage(photoData.dataUrl);
    const prompt = buildPrompt();
    const report = await callDoubao(compressed, prompt);
    lastReport = report;
    hl();
    renderReport(report);
  } catch(e) {
    hl();
    st('分析失败: ' + e.message, 4000);
    console.error(e);
  }
}

// ========== 解析结构化报告 ==========
function parseReport(report) {
  const overallMatch = report.match(/综合评分[：:]\s*(\d+(?:\.\d+)?)\s*[\/／]?\s*10/i);
  const overallScore = overallMatch ? parseFloat(overallMatch[1]) : null;

  const sections = [];
  const sectionRegex = /###?\s*(🌤️?\s*天气评分[：:]?\s*\d+(?:\.\d+)?\s*[\/／]?\s*10|🏞️?\s*地形评分[：:]?\s*\d+(?:\.\d+)?\s*[\/／]?\s*10|⏰\s*作钓时间推荐|🐟\s*鱼种预测|🎣\s*综合作钓建议)/gi;
  const parts = report.split(sectionRegex);

  let currentTitle = '概述';
  let currentContent = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (sectionRegex.test(part)) {
      if (currentTitle !== '概述' || currentContent) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = part.replace(/^###?\s*/, '').trim();
      currentContent = '';
    } else {
      currentContent += part + '\n';
    }
  }
  if (currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent.trim() });
  }

  const lines = report.split('\n').filter(l => l.trim());
  const summaryLine = lines.find(l => l.includes('一句话') || l.match(/^(整体|总体|综合)/)) || '';

  return { overallScore, sections, summaryLine, raw: report };
}

// ========== 渲染结构化报告 ==========
function renderStructuredReport(parsed) {
  const { overallScore, sections, summaryLine, raw } = parsed;

  let html = '';

  // Overall score banner
  if (overallScore !== null) {
    const scoreClass = overallScore >= 7 ? 'score-good' : overallScore >= 5 ? 'score-mid' : 'score-low';
    const scoreStars = '\u2605'.repeat(Math.round(overallScore / 2)) + '\u2606'.repeat(5 - Math.round(overallScore / 2));
    html += `
      <div class="score-banner ${scoreClass}">
        <div class="score-big">${overallScore}<span class="score-unit">/10</span></div>
        <div class="score-stars">${scoreStars}</div>
        <div class="score-label">综合评分</div>
      </div>
    `;
  }

  // Summary line
  if (summaryLine) {
    html += `<div class="report-summary">${escapeHtml(summaryLine)}</div>`;
  }

  // Sections
  for (const sec of sections) {
    const scoreMatch = sec.title.match(/(\d+(?:\.\d+)?)\s*[\/／]?\s*10/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    let icon = '📋';
    if (sec.title.includes('天气')) icon = '🌤️';
    else if (sec.title.includes('地形')) icon = '🏞️';
    else if (sec.title.includes('时间')) icon = '⏰';
    else if (sec.title.includes('鱼种')) icon = '🐟';
    else if (sec.title.includes('建议')) icon = '🎣';

    let content = escapeHtml(sec.content);
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\|(.+)\|/g, (match) => {
      return '<div class="table-row">' + match.split('|').filter(c => c.trim()).map(c => '<span>' + c.trim() + '</span>').join('') + '</div>';
    });
    content = content.replace(/^- (.+)$/gm, '<div class="list-item">• $1</div>');
    content = content.replace(/^\d+\.\s+(.+)$/gm, '<div class="list-item-num">$1</div>');
    content = content.replace(/\n\n/g, '<div class="spacer"></div>');
    content = content.replace(/\n/g, '<br>');

    const scoreBadge = score !== null ? '<span class="section-score">' + score + '/10</span>' : '';

    html += `
      <div class="report-section">
        <div class="section-header">
          <span class="section-icon">${icon}</span>
          <span class="section-title">${escapeHtml(sec.title.replace(/[🌤️🏞️⏰🐟🎣\d.\/]+/g, '').trim())}</span>
          ${scoreBadge}
        </div>
        <div class="section-body">${content}</div>
      </div>
    `;
  }

  return html;
}

// ========== 报告页 ==========
function renderReport(report) {
  const parsed = parseReport(report);
  const structuredHtml = renderStructuredReport(parsed);

  pc.innerHTML = `
    <div class="report-card">
      ${structuredHtml}
    </div>
    <div class="report-actions">
      <button class="btn-save-report" onclick="saveCurrentReport()">
        💾 保存分析记录
      </button>
      <button class="btn-analyze" onclick="renderHome(true)">
        🏠 返回主页
      </button>
    </div>
  `;

  // Store for saving
  pc._lastReport = report;
  pc._lastParsed = parsed;
}

function reportCardHtml(report) {
  const parsed = parseReport(report);
  const structuredHtml = renderStructuredReport(parsed);
  return `<div class="report-card"><h2>📊 上次分析报告</h2>${structuredHtml}</div>`;
}

// ========== 保存当前报告 ==========
async function saveCurrentReport() {
  const report = pc._lastReport;
  if (!report) { st('没有可保存的报告'); return; }

  const parsed = pc._lastParsed || parseReport(report);

  // Extract location string
  const locStr = locationData ? locationData.lat + ', ' + locationData.lon : '未知';

  // Extract weather summary
  let weatherStr = '';
  if (weatherData) {
    weatherStr = weatherData.temperature + '℃ / ' + weatherData.pressure + 'hPa / ' + wd(weatherData.windDirection) + ' ' + weatherData.windSpeed + 'km/h';
  }

  // Extract overall score
  const scoreMatch = report.match(/综合评分[：:]\s*(\d+(?:\.\d+)?)\s*[\/／]?\s*10/i);
  const overallScore = scoreMatch ? scoreMatch[1] : '-';

  // Generate tiny thumbnail (~10KB) for storage instead of full photo (~500KB)
  let thumb = null;
  if (photoData && photoData.dataUrl) {
    try {
      thumb = await makeThumbnail(photoData.dataUrl, 160, 0.35);
    } catch(e) { thumb = null; }
  }

  const record = {
    photo: thumb,
    location: locStr,
    weather: weatherStr,
    score: overallScore,
    report: report,
    lat: locationData ? locationData.lat : null,
    lon: locationData ? locationData.lon : null
  };

  if (saveRecord(record)) {
    st('✅ 已保存到记录');
  }

  // Update button state
  const btn = document.querySelector('.btn-save-report');
  if (btn) {
    btn.textContent = '✅ 已保存';
    btn.disabled = true;
    btn.classList.add('saved');
  }
}

// ========== 记录页 ==========
function renderHistory() {
  const records = getRecords();

  if (records.length === 0) {
    pc.innerHTML = `
      <div class="history-empty">
        <div class="icon">📋</div>
        <p>暂无分析记录</p>
        <p style="color:#bbb;font-size:13px;margin-top:8px">分析完成后保存到这里</p>
      </div>
    `;
    return;
  }

  let html = '<div class="history-list">';
  for (const rec of records) {
    const photoHtml = rec.photo
      ? '<img src="' + rec.photo + '" class="history-photo" onclick="viewRecord(' + rec.id + ')">'
      : '<div class="history-photo-placeholder">📷</div>';

    html += `
      <div class="history-item" onclick="viewRecord(${rec.id})">
        <div class="history-item-left">
          ${photoHtml}
        </div>
        <div class="history-item-right">
          <div class="history-item-date">${rec.date}</div>
          <div class="history-item-loc">📍 ${rec.location}</div>
          <div class="history-item-weather">${rec.weather || '无天气数据'}</div>
          <div class="history-item-score">
            <span class="mini-score">${rec.score}/10</span>
          </div>
        </div>
        <button class="btn-delete-record" onclick="event.stopPropagation();confirmDelete(${rec.id})">
          🗑️
        </button>
      </div>
    `;
  }
  html += '</div>';
  html += '<div style="padding:12px 16px;color:#999;font-size:12px;text-align:center">共 ' + records.length + ' 条记录</div>';

  pc.innerHTML = html;
}

// ========== 查看记录详情 ==========
function viewRecord(id) {
  const records = getRecords();
  const rec = records.find(r => r.id === id);
  if (!rec) { st('记录不存在'); return; }

  const parsed = parseReport(rec.report);
  const structuredHtml = renderStructuredReport(parsed);

  pc.innerHTML = `
    <div class="record-detail-header">
      <button class="btn-back" onclick="renderHistory()">← 返回记录</button>
      <div class="record-detail-date">${rec.date}</div>
    </div>
    <div class="record-detail-info">
      <span>📍 ${rec.location}</span>
      <span>${rec.weather || ''}</span>
    </div>
    <div class="report-card">
      ${structuredHtml}
    </div>
    <button class="btn-delete-full" onclick="confirmDelete(${rec.id})">
      🗑️ 删除这条记录
    </button>
  `;
}

// ========== 确认删除 ==========
function confirmDelete(id) {
  if (confirm('确认删除这条分析记录？')) {
    deleteRecord(id);
  }
}

// ========== 设置页 ==========
function renderSettings() {
  const cfg = getConfig();
  const records = getRecords();
  pc.innerHTML = `
    <div class="settings-card">
      <h2>🔑 AI 模型配置</h2>
      <div class="form-group"><label>API Key</label><input type="password" id="inpKey" value="${cfg.apiKey || ''}" placeholder="豆包API Key"></div>
      <div class="form-group"><label>API 地址</label><input type="text" id="inpUrl" value="${cfg.baseUrl || DEFAULT_BASE_URL}" placeholder="API地址"></div>
      <div class="form-group"><label>模型名称</label><input type="text" id="inpModel" value="${cfg.model || DEFAULT_MODEL}" placeholder="模型名"></div>
      <button class="btn-save" onclick="saveSettings()">保存配置</button>
      <button class="btn-test" onclick="testConn()">测试连接</button>
    </div>
    <div class="settings-card">
      <h2>📊 数据管理</h2>
      <p style="font-size:13px;color:#666;margin-bottom:12px">已保存 <b>${records.length}</b> 条分析记录</p>
      <button class="btn-clear-data" onclick="clearAllRecords()">🗑️ 清空所有记录</button>
    </div>
    <div class="settings-card">
      <h2>ℹ️ 关于</h2>
      <p style="font-size:13px;color:#666;line-height:1.6">
        <b>AI钓点鱼情预测</b> v1.2<br>
        基于豆包大模型的智能钓鱼选点助手。<br>
        拍照分析地形 + GPS + 天气 → 预测鱼情<br><br>
        🌤️ 天气: Open-Meteo<br>
        🤖 AI: 豆包 doubao-seed-2-0-mini
      </p>
    </div>
  `;
}

function clearAllRecords() {
  if (confirm('确认清空所有分析记录？此操作不可恢复。')) {
    localStorage.removeItem('ai_records');
    st('已清空所有记录');
    renderSettings();
  }
}

function saveSettings() {
  const k = document.getElementById('inpKey').value.trim();
  const u = document.getElementById('inpUrl').value.trim();
  const m = document.getElementById('inpModel').value.trim();
  saveConfig({
    apiKey: k || DEFAULT_API_KEY,
    baseUrl: u || DEFAULT_BASE_URL,
    model: m || DEFAULT_MODEL
  });
  st('✅ 配置已保存');
}

async function testConn() {
  sl('测试连接中...');
  try {
    const cfg = getConfig();
    const resp = await fetch((cfg.baseUrl || DEFAULT_BASE_URL) + '/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (cfg.apiKey || DEFAULT_API_KEY)
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        input: [{ role: 'user', content: [{ type: 'input_text', text: '请回复"连接成功"' }] }]
      }),
      signal: AbortSignal.timeout(15000)
    });
    hl();
    if (resp.ok) st('✅ 连接成功！');
    else {
      const err = await resp.text();
      st('❌ ' + err.slice(0, 100));
    }
  } catch(e) { hl(); st('❌ ' + e.message); }
}

// ========== 启动 ==========
renderHome();
