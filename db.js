const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'todos.db');

// 确保 data 目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

// 启用外键支持
db.pragma('foreign_keys = ON');

// 初始化数据库表
function initDatabase() {
  // 创建 categories 表（添加新字段）
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_date BOOLEAN DEFAULT FALSE,
      archived BOOLEAN DEFAULT FALSE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 为现有数据库添加新字段（如果不存在）
  try {
    db.exec('ALTER TABLE categories ADD COLUMN is_date BOOLEAN DEFAULT FALSE');
  } catch (e) {
    // 列已存在，忽略
  }
  try {
    db.exec('ALTER TABLE categories ADD COLUMN archived BOOLEAN DEFAULT FALSE');
  } catch (e) {
    // 列已存在，忽略
  }

  // 插入默认分类 Pool（如果不存在）
  db.exec(`
    INSERT OR IGNORE INTO categories (id, name, sort_order)
    VALUES (1, 'Pool', 0)
  `);

  // 创建 todos 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
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
    )
  `);

  // 创建 archives 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      year TEXT NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    )
  `);

  // 创建索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id)');

  console.log('数据库初始化完成');
}

// CRUD 操作
const todoDao = {
  // 创建 TODO
  create(todo) {
    const { title, description, parent_id, category_id = 1, date, sort_order = 0 } = todo;
    const stmt = db.prepare(`
      INSERT INTO todos (title, description, parent_id, category_id, date, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description || null, parent_id || null, category_id, date, sort_order);
    return this.getById(result.lastInsertRowid);
  },

  // 获取单个 TODO
  getById(id) {
    const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    return stmt.get(id);
  },

  // 获取所有 TODO（按分类和排序）
  getAll(categoryFilter = null) {
    if (categoryFilter) {
      const stmt = db.prepare(`
        SELECT * FROM todos
        WHERE category_id = ?
        ORDER BY sort_order, created_at
      `);
      return stmt.all(categoryFilter);
    }
    const stmt = db.prepare('SELECT * FROM todos ORDER BY category_id, sort_order, created_at');
    return stmt.all();
  },

  // 获取指定分类的 TODO
  getByCategory(categoryId) {
    const stmt = db.prepare(`
      SELECT * FROM todos
      WHERE category_id = ?
      ORDER BY sort_order, created_at
    `);
    return stmt.all(categoryId);
  },

  // 获取子条目
  getChildren(parentId) {
    const stmt = db.prepare(`
      SELECT * FROM todos
      WHERE parent_id = ?
      ORDER BY sort_order, created_at
    `);
    return stmt.all(parentId);
  },

  // 更新 TODO
  update(id, updates) {
    const allowedFields = ['title', 'description', 'completed', 'parent_id', 'category_id', 'date', 'sort_order'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE todos SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    // 如果更新了 category_id，级联更新所有子条目的 category_id
    if (updates.category_id !== undefined) {
      const updateChildren = db.prepare(`
        UPDATE todos SET category_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE parent_id = ?
      `);
      updateChildren.run(updates.category_id, id);
    }

    return this.getById(id);
  },

  // 删除 TODO
  delete(id) {
    const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
    return stmt.run(id);
  },

  // 批量更新排序顺序
  updateOrder(items) {
    const stmt = db.prepare('UPDATE todos SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const updateMany = db.transaction((items) => {
      for (const { id, sort_order } of items) {
        stmt.run(sort_order, id);
      }
    });
    updateMany(items);
    return true;
  },

  // 获取所有日期（用于归档）
  getAllDates() {
    const stmt = db.prepare('SELECT DISTINCT date FROM todos ORDER BY date');
    return stmt.all().map(row => row.date);
  },

  // 获取日期范围内的所有 TODO
  getDateRange(startDate, endDate) {
    const stmt = db.prepare(`
      SELECT * FROM todos
      WHERE date >= ? AND date <= ?
      ORDER BY date, sort_order, created_at
    `);
    return stmt.all(startDate, endDate);
  },

  // 归档 TODO 数据
  archive(year, month, data) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO archives (year, month, data)
      VALUES (?, ?, ?)
    `);
    return stmt.run(year, month, JSON.stringify(data));
  },

  // 获取归档数据
  getArchive(year, month) {
    const stmt = db.prepare('SELECT * FROM archives WHERE year = ? AND month = ?');
    return stmt.get(year, month);
  },

  // 获取所有归档记录
  getAllArchives() {
    const stmt = db.prepare('SELECT * FROM archives ORDER BY year DESC, month DESC');
    return stmt.all();
  },

  // 删除已归档的 TODO（归档后清理）
  deleteByDateRange(startDate, endDate) {
    const stmt = db.prepare('DELETE FROM todos WHERE date >= ? AND date <= ?');
    return stmt.run(startDate, endDate);
  },

  // ==================== 分类相关方法 ====================

  // 获取所有分类（排除已归档的，除非指定 includeArchived）
  getAllCategories(includeArchived = false) {
    let sql = 'SELECT * FROM categories WHERE 1=1';
    if (!includeArchived) {
      sql += ' AND (archived = 0 OR archived IS NULL)';
    }
    sql += ' ORDER BY sort_order, name';
    const stmt = db.prepare(sql);
    return stmt.all();
  },

  // 创建分类
  createCategory(name, sort_order = 0, is_date = false) {
    const stmt = db.prepare('INSERT INTO categories (name, sort_order, is_date) VALUES (?, ?, ?)');
    const result = stmt.run(name, sort_order, is_date ? 1 : 0);
    return this.getCategoryById(result.lastInsertRowid);
  },

  // 获取分类
  getCategoryById(id) {
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ?');
    return stmt.get(id);
  },

  // 更新分类
  updateCategory(id, updates) {
    const allowedFields = ['name', 'sort_order', 'is_date', 'archived'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        // 布尔值转换为 0/1
        if (key === 'is_date' || key === 'archived') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return this.getCategoryById(id);

    values.push(id);
    const stmt = db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getCategoryById(id);
  },

  // 归档分类（将分类下的所有 TODO 归档到 archives 表）
  archiveCategory(id) {
    const category = this.getCategoryById(id);
    if (!category) return false;

    // 获取该分类下的所有 TODO
    const todos = this.getByCategory(id);

    if (todos.length > 0) {
      // 保存到 archives 表
      const archiveData = {
        category_name: category.name,
        todos: todos
      };
      this.archive(new Date().getFullYear().toString(), String(new Date().getMonth() + 1).padStart(2, '0'), archiveData);
    }

    // 删除该分类下的所有 TODO
    const deleteTodos = db.prepare('DELETE FROM todos WHERE category_id = ?');
    deleteTodos.run(id);

    // 标记分类为已归档
    const updateCategory = db.prepare('UPDATE categories SET archived = 1 WHERE id = ?');
    updateCategory.run(id);

    return true;
  },

  // 删除分类
  deleteCategory(id) {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    return stmt.run(id);
  },

  // 批量更新分类顺序
  reorderCategories(order) {
    const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
    const updateMany = db.transaction((order) => {
      for (let i = 0; i < order.length; i++) {
        stmt.run(i, order[i]);
      }
    });
    updateMany(order);
    return true;
  },
};

module.exports = {
  db,
  initDatabase,
  todoDao,
};
