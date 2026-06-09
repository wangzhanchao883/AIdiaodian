# AI 钓点鱼情预测 🎣

基于豆包大模型的智能钓鱼选点助手。拍照分析地形 + GPS 定位 + 天气数据 + 水域识别 → AI 预测鱼情。

## 功能

- 📸 **拍照识别**：拍摄钓点照片，AI 分析地形特征
- 📍 **GPS 定位**：自动获取钓点坐标，用于查天气和水域
- 🌤️ **天气数据**：实时获取气温、气压、风速等钓鱼关键指标
- 🌊 **水域识别**：通过 GPS 定位自动识别所在河流/湖泊/水库
- 🤖 **AI 预测**：豆包 doubao-seed-2-0-mini 模型输出结构化评分报告
- 🐟 **鱼种预测**：按可能性排序，含推荐钓法、装备、饵料
- 💾 **本地记录**：保存分析记录，支持查看和删除

## 技术栈

- **前端**：原生 HTML/CSS/JS + Capacitor 6
- **后端**：Express.js（开发调试用，生产环境纯前端直连 API）
- **AI**：火山引擎豆包 doubao-seed-2-0-mini（多模态）
- **天气**：Open-Meteo（免费，无需 API Key）
- **水域识别**：OpenStreetMap Nominatim（免费，无需 API Key）
- **打包**：Capacitor Android → APK

## 开发

```bash
npm install
# 修改 public/js/app.js 中的默认 API Key
cd android
./gradlew assembleDebug
```

## 下载 APK

前往 [Releases](https://github.com/wangzhanchao883/AIdiaodian/releases) 页面下载最新 APK。
