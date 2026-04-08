const express = require('express');
const path = require('path');
const { initDatabase, todoDao } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8210;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/backgrounds', express.static(path.join(__dirname, 'data', 'backgrounds')));

// API 路由
app.use('/api', apiRoutes);

// 服务前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 历史记录页面
app.get('/archives', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

// 归档详情页面
app.get('/archives/:year/:month', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

// 设置页面
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// 初始化数据库并启动服务
initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TODO Web 服务已启动，端口：${PORT}`);
  console.log(`访问地址：http://localhost:${PORT}`);
});

module.exports = app;
