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

  // 创建 archives 表（已废弃，仅保留向后兼容）
  // 归档逻辑已改为仅标记分类的 archived 字段，不再使用 archives 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      year TEXT NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 settings 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // 检查 parent_id 是否有效（不能指向自己）
    if (parent_id) {
      const parent = this.getById(parent_id);
      if (!parent) {
        throw new Error('Parent TODO does not exist');
      }
    }

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

  // 检查是否会形成循环引用（检测 newParentId 是否是 id 的后代）
  wouldCreateCycle(id, newParentId) {
    if (!newParentId) return false; // parent_id 为 NULL 不会形成循环
    if (id === newParentId) return true; // 不能将自己设为父级

    // 从 newParentId 开始，向上追溯它的祖先链，看是否会遇到 id
    // 如果 newParentId 的祖先包含 id，说明 id 是 newParentId 的后代，形成循环
    const checkAncestors = (currentId, depth = 0) => {
      if (depth > 100) return true; // 防止无限递归
      if (currentId === id) return true; // 找到循环：newParentId 的祖先是 id

      // 获取当前条目的父级
      const stmt = db.prepare('SELECT parent_id FROM todos WHERE id = ?');
      const row = stmt.get(currentId);
      if (!row || !row.parent_id) return false; // 没有父级了

      return checkAncestors(row.parent_id, depth + 1);
    };

    return checkAncestors(newParentId);
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

    // 检查是否会形成循环引用
    if (updates.parent_id !== undefined) {
      if (this.wouldCreateCycle(id, updates.parent_id)) {
        throw new Error('Cannot set parent_id: would create circular reference');
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE todos SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    // 如果更新了 category_id，级联更新所有子条目的 category_id
    if (updates.category_id !== undefined) {
      // 递归获取所有子孙条目 ID
      const getAllDescendants = (parentId) => {
        const stmt = db.prepare('SELECT id FROM todos WHERE parent_id = ?');
        const children = stmt.all(parentId);
        const descendants = [...children];
        for (const child of children) {
          descendants.push(...getAllDescendants(child.id));
        }
        return descendants;
      };

      const descendants = getAllDescendants(id);
      if (descendants.length > 0) {
        const updateChildren = db.prepare(`
          UPDATE todos SET category_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        const updateMany = db.transaction((descendants) => {
          for (const descendant of descendants) {
            updateChildren.run(updates.category_id, descendant.id);
          }
        });
        updateMany(descendants);
      }
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

  // 获取所有归档记录（已废弃，仅保留向后兼容）
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

  // 归档分类（仅标记分类为已归档状态，不删除数据）
  archiveCategory(id) {
    const category = this.getCategoryById(id);
    if (!category) return false;

    // 只需将分类标记为已归档
    // 已归档的分类不会在待办列表中显示（getAllCategories 默认排除 archived=1 的分类）
    // 数据仍然保留在 todos 表中，可以在历史记录页面查看
    const updateCategory = db.prepare('UPDATE categories SET archived = 1 WHERE id = ?');
    updateCategory.run(id);

    return true;
  },

  // 取消归档分类（将分类的 archived 标记设为 0）
  unarchiveCategory(id) {
    const category = this.getCategoryById(id);
    if (!category) return false;

    const updateCategory = db.prepare('UPDATE categories SET archived = 0 WHERE id = ?');
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

  // ==================== 设置相关方法 ====================

  // 获取所有设置
  getAllSettings() {
    const stmt = db.prepare('SELECT * FROM settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  },

  // 获取单个设置
  getSetting(key) {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : null;
  },

  // 更新设置
  updateSetting(key, value) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(key, value);
  },

  // 批量更新设置
  updateSettings(settings) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    const updateMany = db.transaction((settings) => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value);
      }
    });
    updateMany(settings);
    return true;
  },
};

module.exports = {
  db,
  initDatabase,
  todoDao,
};
