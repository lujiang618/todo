# TODO Web 应用 - 产品需求文档

## 项目概述
基于 Web 的 TODO List 管理系统，使用 SQLite 存储数据，支持分类管理、拖拽排序和搜索功能。

## 技术栈
- 后端：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 前端：HTML + CSS + 原生 JavaScript

## 功能需求

### 1. POOL 池管理
- 创建一个全局 POOL 池，用于存放未分类的待办事项
- 支持添加、编辑、删除 TODO 条目
- 每个条目包含：标题、完成状态、创建时间、分类
- 每个条目都有复选框，可勾选完成状态
- 支持子条目（至少 2 级嵌套）

### 2. 分类管理
- 系统默认有一个 "Pool" 分类（id=1）
- 支持创建新分类
- 支持编辑分类名称
- 支持删除分类（同时删除该分类下所有条目）
- 支持为分类添加待办条目

### 3. 拖拽功能
- POOL 中的条目可拖拽到任意分类
- 分类中的条目可拖拽到另一个分类
- 分类中的条目可拖拽回 POOL
- 拖拽时有视觉反馈（高亮边框）

### 4. 搜索功能
- 支持搜索分类名称
- 支持搜索待办条目内容
- 搜索结果实时显示
- 匹配文本高亮显示

### 5. 待办条目管理
- 每个条目有复选框，可切换完成状态
- 支持添加子条目
- 支持编辑条目
- 支持删除条目
- 完成状态有条目删除线和灰色文字样式

## 数据模型

### Categories 表
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Todos 表
```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  parent_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
  category_id INTEGER DEFAULT 1 REFERENCES categories(id) ON DELETE SET NULL,
  date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Archives 表（用于归档记录）
```sql
CREATE TABLE archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, month)
);
```

## API 端点

### 分类管理
- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建新分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### TODO 管理
- `GET /api/todos` - 获取所有待办
- `GET /api/todos?category_id=1` - 获取指定分类的待办
- `POST /api/todos` - 创建新待办
- `PUT /api/todos/:id` - 更新待办
- `DELETE /api/todos/:id` - 删除待办

### 归档管理
- `GET /api/archives/:year/:month` - 获取指定月份的归档数据
- `GET /api/archives` - 获取所有归档列表
- `POST /api/archives/archive` - 手动触发归档

### 系统管理
- `GET /api/health` - 健康检查

## 前端页面

### 主页面 (`/`)
- POOL 池视图（左侧或顶部）
- 待办列表视图（分类列表）
- 搜索框（实时搜索分类和条目）
- 添加分类按钮（弹窗输入）
- 拖拽功能

### 归档查看页面 (`/archive.html`)
- 历史月份数据查看
- 只读模式

## 界面布局

```
┌─────────────────────────────────────────────┐
│                    TODO                      │
├─────────────────────────────────────────────┤
│  POOL                                       │
│  ┌─────────────────────────────────────┐    │
│  │ [输入框] [+]                         │    │
│  │ - TODO 条目 1 ☐                      │    │
│  │ - TODO 条目 2 ☐                      │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  待办列表                                   │
│  ┌─────────────────────────────────────┐    │
│  │ [🔍 搜索...] [添加分类]              │    │
│  ├─────────────────────────────────────┤    │
│  │ 分类 1 ✏️ ➕ 🗑️                      │    │
│  │   - 条目 1 ☐                         │    │
│  │   - 条目 2 ☐                         │    │
│  ├─────────────────────────────────────┤    │
│  │ 分类 2 ✏️ ➕ 🗑️                      │    │
│  │   - 条目 1 ☐                         │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## 目录结构
```
project/
├── server.js                    # 主服务器文件
├── db.js                        # 数据库操作
├── routes/
│   └── api.js                   # API 路由
├── public/
│   ├── index.html               # 主页面
│   ├── archive.html             # 归档页面
│   ├── css/
│   │   └── style.css            # 样式文件
│   ├── js/
│   │   └── app.js               # 前端逻辑
│   └── images/                  # 图标资源
├── data/                        # 数据目录
│   └── todos.db                 # SQLite 数据库
├── scripts/
│   └── migrate-to-categories.js # 数据迁移脚本
├── .gitignore                   # Git 忽略文件
└── .taskmaster/                 # Task Master 配置
    └── docs/
        └── prd.md               # 产品需求文档
```

## 验收标准

1. POOL 池功能正常，可添加、编辑、删除条目
2. 每个条目都有复选框，可切换完成状态
3. 分类功能正常，可创建、编辑、删除
4. 拖拽功能正常：
   - POOL → 分类 ✓
   - 分类 → 分类 ✓
   - 分类 → POOL ✓
5. 搜索功能正常，支持分类名称和条目内容搜索
6. 搜索结果匹配文本高亮显示
7. 添加分类使用弹窗输入
8. 分类可添加待办条目
9. 子条目至少支持 2 级嵌套

## 版本历史

### v1.0.0 (当前版本)
- 基于分类系统的 TODO 管理
- POOL 池与分类拖拽
- 实时搜索功能
- 分类管理（增删改）
- 待办条目管理（增删改、完成状态）
