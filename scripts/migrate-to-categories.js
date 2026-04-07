// 数据库迁移脚本：将现有的 date 字段迁移到新的 category_id 系统
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'todos.db');
const db = new Database(DB_PATH);

console.log('开始数据库迁移...');

try {
  // 1. 确保 categories 表存在
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. 插入默认分类 Pool（如果不存在）
  db.exec(`
    INSERT OR IGNORE INTO categories (id, name, sort_order)
    VALUES (1, 'Pool', 0)
  `);

  // 3. 修改 todos 表，添加 category_id 列（如果不存在）
  // SQLite 不支持直接添加列，需要检查是否存在
  const tableInfo = db.pragma("table_info('todos')");
  const hasCategoryId = tableInfo.some(col => col.name === 'category_id');

  if (!hasCategoryId) {
    // 创建新表并迁移数据
    db.exec(`
      CREATE TABLE todos_new (
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

    // 迁移现有数据
    db.exec(`
      INSERT INTO todos_new (id, title, description, completed, parent_id, category_id, date, sort_order, created_at, updated_at)
      SELECT
        id, title, description, completed, parent_id,
        CASE
          WHEN date = 'pool' THEN 1  -- Pool 分类
          ELSE 1  -- 其他默认到 Pool
        END as category_id,
        date, sort_order, created_at, updated_at
      FROM todos
    `);

    // 删除旧表，重命名新表
    db.exec('DROP TABLE todos');
    db.exec('ALTER TABLE todos_new RENAME TO todos');

    // 重新创建索引
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id)');

    console.log('已添加 category_id 列并迁移数据');
  } else {
    console.log('category_id 列已存在');
  }

  // 4. 为每个唯一的 date 值创建分类（除了 'pool'）
  const uniqueDates = db.prepare("SELECT DISTINCT date FROM todos WHERE date NOT IN ('pool', 'custom')").all();

  for (const row of uniqueDates) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO categories (name, sort_order)
        VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))
      `).run(row.date);
      console.log(`创建分类：${row.date}`);
    } catch (e) {
      if (!e.message.includes('UNIQUE constraint failed')) {
        throw e;
      }
    }
  }

  // 5. 更新 todos 的 category_id，将 date 映射到对应的分类
  db.exec(`
    UPDATE todos
    SET category_id = (
      SELECT categories.id FROM categories
      WHERE categories.name = todos.date
    )
    WHERE todos.date NOT IN ('pool', 'custom')
      AND todos.date IS NOT NULL
      AND EXISTS (SELECT 1 FROM categories WHERE categories.name = todos.date)
  `);

  console.log('已更新 todos 的 category_id');

  // 6. 为 date='custom' 的条目创建分类（这些是待办列表中的日期容器）
  const customDateEntries = db.prepare("SELECT DISTINCT title FROM todos WHERE date = 'custom' AND parent_id IS NULL").all();

  for (const row of customDateEntries) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO categories (name, sort_order)
        VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))
      `).run(row.title);
      console.log(`创建分类（从日期容器）：${row.title}`);
    } catch (e) {
      if (!e.message.includes('UNIQUE constraint failed')) {
        throw e;
      }
    }
  }

  // 7. 更新 date='custom' 的条目的 category_id
  db.exec(`
    UPDATE todos
    SET category_id = (
      SELECT categories.id FROM categories
      WHERE categories.name = todos.title
    )
    WHERE todos.date = 'custom'
      AND parent_id IS NULL
      AND EXISTS (SELECT 1 FROM categories WHERE categories.name = todos.title)
  `);

  console.log('迁移完成！');

  // 8. 显示分类统计
  console.log('\n分类统计:');
  const stats = db.prepare(`
    SELECT c.name, COUNT(t.id) as todo_count
    FROM categories c
    LEFT JOIN todos t ON c.id = t.category_id
    GROUP BY c.id, c.name
    ORDER BY c.sort_order
  `).all();

  stats.forEach(s => {
    console.log(`  ${s.name}: ${s.todo_count} 条待办`);
  });

} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n迁移完成！请重启应用以使用新的分类系统。');
