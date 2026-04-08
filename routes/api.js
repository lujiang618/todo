const express = require('express');
const { todoDao, db } = require('../db');

const router = express.Router();

// ==================== 分类相关 API ====================

// 获取所有分类
router.get('/categories', (req, res) => {
  try {
    const categories = todoDao.getAllCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建分类
router.post('/categories', (req, res) => {
  try {
    const { name, sort_order, is_date } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const category = todoDao.createCategory(name, sort_order, is_date);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Category name already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 归档分类
router.post('/categories/:id/archive', (req, res) => {
  try {
    const result = todoDao.archiveCategory(req.params.id);
    if (result) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Category not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新分类顺序（必须在 /categories/:id 之前定义）
router.put('/categories/reorder', (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'Order must be an array' });
    }
    todoDao.reorderCategories(order);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新分类
router.put('/categories/:id', (req, res) => {
  try {
    const category = todoDao.updateCategory(req.params.id, req.body);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除分类
router.delete('/categories/:id', (req, res) => {
  try {
    todoDao.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TODO 相关 API ====================

// 获取所有 TODO（按分类过滤）
router.get('/todos', (req, res) => {
  try {
    const { category_id } = req.query;
    const todos = todoDao.getAll(category_id ? parseInt(category_id) : null);
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个 TODO
router.get('/todos/:id', (req, res) => {
  try {
    const todo = todoDao.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'TODO not found' });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建 TODO
router.post('/todos', (req, res) => {
  try {
    const { title, description, parent_id, category_id, date, sort_order } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    // category_id 可选，默认为 1（Pool）
    const todo = todoDao.create({ title, description, parent_id, category_id, date, sort_order });
    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量更新排序（必须在 /todos/:id 之前定义）
router.put('/todos/reorder', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items must be an array' });
    }
    todoDao.updateOrder(items);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新 TODO
router.put('/todos/:id', (req, res) => {
  try {
    const todo = todoDao.update(req.params.id, req.body);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'TODO not found' });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除 TODO
router.delete('/todos/:id', (req, res) => {
  try {
    todoDao.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取归档数据
router.get('/archives/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const archive = todoDao.getArchive(year, month);
    if (!archive) {
      return res.status(404).json({ success: false, error: 'Archive not found' });
    }
    // 解析 data 字段（JSON 字符串）
    const archiveData = {
      ...archive,
      data: typeof archive.data === 'string' ? JSON.parse(archive.data) : archive.data
    };
    res.json({ success: true, data: archiveData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有归档列表
router.get('/archives', (req, res) => {
  try {
    const archives = todoDao.getAllArchives();
    res.json({ success: true, data: archives });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发归档
router.post('/archives/archive', (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ success: false, error: 'Year and month are required' });
    }

    // 获取该月的所有 TODO
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const todos = todoDao.getDateRange(startDate, endDate);

    // 归档
    todoDao.archive(year, month, { todos });

    // 可选：删除已归档的数据
    // todoDao.deleteByDateRange(startDate, endDate);

    res.json({ success: true, message: `Archived ${todos.length} todos for ${year}-${month}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 设置相关 API ====================

// 获取所有设置
router.get('/settings', (req, res) => {
  try {
    const settings = todoDao.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新设置
router.put('/settings', (req, res) => {
  try {
    const settings = req.body;
    todoDao.updateSettings(settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上传背景图片
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保背景目录存在
const bgDir = path.join(__dirname, '..', 'data', 'backgrounds');
if (!fs.existsSync(bgDir)) {
  fs.mkdirSync(bgDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bgDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `bg-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件（jpg, png, gif, webp）'));
    }
  }
});

router.post('/settings/background-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // 返回文件名，保存到数据库
    res.json({
      success: true,
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
