const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { initDatabase, todoDao } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8210;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api', apiRoutes);

// 服务前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 归档页面
app.get('/archives/:year/:month', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'archive.html'));
});

// 每月任务：1 号 00:00 自动归档上月数据
cron.schedule('0 0 1 * *', () => {
  console.log('执行每月任务：归档上月数据');
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonth.getFullYear().toString();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');

  try {
    // 获取上个月的所有 TODO
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const todos = todoDao.getDateRange(startDate, endDate);

    if (todos.length > 0) {
      // 创建归档目录
      const fs = require('fs');
      const archiveDir = path.join(__dirname, 'data', year, month);
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      // 保存归档文件
      const archiveFile = path.join(archiveDir, 'todos.json');
      fs.writeFileSync(archiveFile, JSON.stringify(todos, null, 2));

      // 同时保存到数据库
      todoDao.archive(year, month, { todos });

      console.log(`已归档 ${todos.length} 条 ${year}-${month} 的 TODO 数据`);
    } else {
      console.log(`${year}-${month} 没有需要归档的数据`);
    }
  } catch (error) {
    console.error('归档失败:', error);
  }
});

// 初始化数据库并启动服务
initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TODO Web 服务已启动，端口：${PORT}`);
  console.log(`访问地址：http://localhost:${PORT}`);
});

module.exports = app;
