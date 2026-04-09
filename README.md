# TODO Web 应用

基于 Node.js + Express + SQLite 的 TODO List 管理系统。

## 功能特性

- **TODO 池**: 全局待办事项池，用于存放未分配的功能
- **待办列表**: 以列表形式管理待办，复选框勾选表示完成
- **多级列表**: 支持父子条目嵌套，可拖拽调整顺序
- **每日自动生成**: 每天凌晨自动生成当天的待办条目
- **月度归档**: 每月 1 号自动归档上月数据到 `data/{年}/{月}/` 目录
- **开机自启动**: 支持 Ubuntu systemd 开机自启动

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

访问 http://localhost:8210

## 配置开机自启动

```bash
# 安装服务（使用 sudo）
sudo ./scripts/setup-autostart.sh install

# 查看状态
sudo ./scripts/setup-autostart.sh status

# 其他命令
sudo ./scripts/setup-autostart.sh stop      # 停止
sudo ./scripts/setup-autostart.sh start     # 启动
sudo ./scripts/setup-autostart.sh restart   # 重启
sudo ./scripts/setup-autostart.sh uninstall # 卸载
```

## 目录结构

```
project/
├── server.js              # 主服务器文件
├── db.js                  # 数据库操作
├── routes/
│   └── api.js             # API 路由
├── public/
│   ├── index.html         # 主页面
│   ├── archive.html       # 归档查看页面
│   ├── css/
│   │   └── style.css      # 样式文件
│   └── js/
│       └── app.js         # 前端逻辑
├── data/                  # 数据和归档目录
│   └── {year}/{month}/
├── scripts/
│   └── setup-autostart.sh # 自启动配置脚本
└── services/              # systemd 服务文件（安装时生成）
```

## API 端点

### TODO 管理
- `GET /api/todos?date=YYYY-MM-DD` - 获取待办列表
- `POST /api/todos` - 创建待办
- `PUT /api/todos/:id` - 更新待办
- `DELETE /api/todos/:id` - 删除待办
- `PUT /api/todos/reorder` - 调整顺序

### 归档管理
- `GET /api/archives/:year/:month` - 获取归档数据
- `GET /api/archives` - 获取所有归档列表
- `POST /api/archives/archive` - 手动触发归档

### 系统
- `GET /api/health` - 健康检查

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 8210 |
| NODE_ENV | 运行环境 | development |

## 定时任务

- **每日 00:00**: 自动生成当天的 TODO 条目
- **每月 1 号 00:00**: 自动归档上月数据

## Docker 部署

### 方式一：Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

数据通过 Docker volume 持久化，即使容器删除数据也不会丢失。

### 方式二：Docker 命令

```bash
# 构建镜像
docker build -t todo-web .

# 启动容器
docker run -d \
  --name todo-web \
  -p 8210:8210 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  todo-web
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 8210 |
| NODE_ENV | 运行环境 | production |

## 技术栈

- 后端：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 定时任务：node-cron
- 前端：HTML + CSS + 原生 JavaScript
