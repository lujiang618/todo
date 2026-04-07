// ==================== 状态管理 ====================
let allCategories = [];     // 所有分类
let categoryTodos = {};     // 每个分类下的 TODO { categoryId: todos[] }
let editingId = null;
let draggedItem = null;     // 当前拖动的条目
let searchQuery = '';       // 搜索关键词

// 默认分类 ID（Pool）
const DEFAULT_CATEGORY_ID = 1;

// ==================== API 请求封装 ====================
const api = {
  // 获取所有分类
  async getCategories() {
    const res = await fetch('/api/categories');
    const data = await res.json();
    return data.success ? data.data : [];
  },

  // 创建分类
  async createCategory(name) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // 更新分类
  async updateCategory(id, updates) {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // 删除分类
  async deleteCategory(id) {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // 获取所有 TODO（可按分类过滤）
  async getTodos(categoryId = null) {
    const url = categoryId ? `/api/todos?category_id=${categoryId}` : '/api/todos';
    const res = await fetch(url);
    const data = await res.json();
    return data.success ? data.data : [];
  },

  // 创建 TODO
  async createTodo(todo) {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todo)
    });
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // 更新 TODO
  async updateTodo(id, updates) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // 删除 TODO
  async deleteTodo(id) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },
};

// ==================== 渲染函数 ====================

// 渲染分类列表（待办列表区域）
function renderCategoryList(container, searchTerm = '') {
  container.innerHTML = '';

  // 过滤掉 Pool 分类（Pool 单独显示）
  let categories = allCategories.filter(c => c.id !== DEFAULT_CATEGORY_ID);

  // 根据搜索关键词过滤
  if (searchTerm) {
    const query = searchTerm.toLowerCase();
    categories = categories.filter(c => c.name.toLowerCase().includes(query));
    // 同时也过滤该分类下的 TODO
    const matchedCategoryIds = allCategories
      .filter(c => c.id !== DEFAULT_CATEGORY_ID && c.name.toLowerCase().includes(query))
      .map(c => c.id);

    // 如果搜索，也显示包含匹配 TODO 的分类
    const categoriesWithMatchingTodos = Object.entries(categoryTodos)
      .filter(([catId, todos]) => {
        if (parseInt(catId) === DEFAULT_CATEGORY_ID) return false;
        return todos.some(t => t.title.toLowerCase().includes(query));
      })
      .map(([catId]) => parseInt(catId));

    // 合并两种匹配结果
    const allMatchedIds = [...matchedCategoryIds, ...categoriesWithMatchingTodos];
    categories = allCategories.filter(c => allMatchedIds.includes(c.id));
  }

  if (categories.length === 0) {
    if (searchTerm) {
      container.innerHTML = '<div class="empty-state">未找到匹配的分类</div>';
    } else {
      container.innerHTML = '<div class="empty-state">暂无分类，请添加分类</div>';
    }
    return;
  }

  categories.forEach(category => {
    const categoryEl = createCategoryElement(category, searchTerm);
    container.appendChild(categoryEl);
  });
}

// 创建分类元素（作为拖拽目标容器）
function createCategoryElement(category, searchTerm = '') {
  const div = document.createElement('div');
  div.className = 'category-container';
  div.dataset.categoryId = category.id;
  div.dataset.categoryName = category.name;

  const header = document.createElement('div');
  header.className = 'category-header';
  header.innerHTML = `
    <span class="category-name">${highlightMatch(category.name, searchTerm)}</span>
    <div class="category-actions">
      <button class="btn-edit-category" title="编辑分类">✏️</button>
      <button class="btn-add-todo" title="添加待办">➕</button>
      <button class="btn-delete-category" title="删除分类">🗑️</button>
    </div>
  `;

  // 编辑分类按钮
  header.querySelector('.btn-edit-category').addEventListener('click', () => {
    showEditCategoryForm(category.id, category.name);
  });

  // 添加待办按钮
  header.querySelector('.btn-add-todo').addEventListener('click', () => {
    showAddTodoToCategory(category.id, category.name);
  });

  // 删除分类按钮
  header.querySelector('.btn-delete-category').addEventListener('click', async () => {
    const todosInCategory = categoryTodos[category.id] || [];
    const count = todosInCategory.length;
    if (confirm(`确定要删除分类 "${category.name}" 吗？${count > 0 ? `该分类下的 ${count} 个条目也将被删除。` : ''}`)) {
      // 先删除该分类下的所有 TODO
      for (const todo of todosInCategory) {
        await api.deleteTodo(todo.id);
      }
      // 再删除分类
      await api.deleteCategory(category.id);
      loadAllData();
    }
  });

  const todoList = document.createElement('div');
  todoList.className = 'todo-list';
  todoList.dataset.categoryId = category.id;

  // 渲染该分类下的 TODO
  const todos = categoryTodos[category.id] || [];
  let rootTodos = todos.filter(t => !t.parent_id);

  // 搜索时过滤 TODO
  if (searchTerm) {
    rootTodos = rootTodos.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }

  const childrenMap = {};
  todos.filter(t => t.parent_id).forEach(t => {
    if (!childrenMap[t.parent_id]) childrenMap[t.parent_id] = [];
    childrenMap[t.parent_id].push(t);
  });

  rootTodos.forEach(todo => {
    const itemEl = createTodoElement(todo, childrenMap[todo.id] || [], false);
    todoList.appendChild(itemEl);
  });

  // 设置拖拽接收
  setupCategoryDropTarget(div, category);

  div.appendChild(header);
  div.appendChild(todoList);
  return div;
}

// 渲染 POOL 列表
function renderPoolList(container) {
  container.innerHTML = '';

  const todos = categoryTodos[DEFAULT_CATEGORY_ID] || [];
  let rootTodos = todos.filter(t => !t.parent_id);

  // 搜索时过滤 TODO
  if (searchQuery) {
    rootTodos = rootTodos.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const childrenMap = {};
  todos.filter(t => t.parent_id).forEach(t => {
    if (!childrenMap[t.parent_id]) childrenMap[t.parent_id] = [];
    childrenMap[t.parent_id].push(t);
  });

  if (rootTodos.length === 0) {
    if (searchQuery) {
      container.innerHTML = '<div class="empty-state">POOL 中没有匹配的条目</div>';
    } else {
      container.innerHTML = '<div class="empty-state">POOL 为空，添加一些待办事项吧</div>';
    }
    return;
  }

  rootTodos.forEach(todo => {
    const itemEl = createTodoElement(todo, childrenMap[todo.id] || [], true);
    container.appendChild(itemEl);
  });

  // 设置 POOL 为拖拽目标
  setupPoolDropTarget(container);
}

// 创建 TODO 元素
function createTodoElement(todo, children = [], isPool = false) {
  const template = document.getElementById('todoItemTemplate');
  const clone = template.content.cloneNode(true);
  const itemEl = clone.querySelector('.todo-item');

  itemEl.dataset.id = todo.id;
  itemEl.dataset.categoryId = todo.category_id;

  const checkbox = itemEl.querySelector('.todo-checkbox');
  const titleEl = itemEl.querySelector('.todo-title');
  const addChildBtn = itemEl.querySelector('.btn-add-child');
  const editBtn = itemEl.querySelector('.btn-edit');
  const deleteBtn = itemEl.querySelector('.btn-delete');
  const childrenList = itemEl.querySelector('.children-list');

  // 复选框状态
  checkbox.checked = todo.completed ? 1 : 0;
  if (todo.completed) itemEl.classList.add('completed');

  // 复选框事件
  checkbox.addEventListener('change', async () => {
    await api.updateTodo(todo.id, { completed: checkbox.checked ? 1 : 0 });
    itemEl.classList.toggle('completed', checkbox.checked);
    // 更新本地状态
    const cat = categoryTodos[todo.category_id];
    if (cat) {
      const t = cat.find(x => x.id === todo.id);
      if (t) t.completed = checkbox.checked ? 1 : 0;
    }
  });

  titleEl.textContent = todo.title;

  // 添加子条目按钮
  addChildBtn.addEventListener('click', () => {
    showAddChildForm(todo.id, todo.category_id);
  });

  // 编辑按钮
  editBtn.addEventListener('click', () => {
    showEditForm(todo.id, todo.title);
  });

  // 删除按钮
  deleteBtn.addEventListener('click', async () => {
    if (confirm('确定要删除这个条目吗？')) {
      await api.deleteTodo(todo.id);
      loadAllData();
    }
  });

  // 拖拽功能 - 所有条目都可以拖动
  itemEl.setAttribute('draggable', true);
  setupTodoDragAndDrop(itemEl, todo);

  // 渲染子条目
  if (children.length > 0) {
    children.forEach(child => {
      const childEl = createChildElement(child);
      const li = document.createElement('li');
      li.appendChild(childEl);
      childrenList.appendChild(li);
    });
  } else {
    childrenList.style.display = 'none';
  }

  return itemEl;
}

// 创建子条目元素
function createChildElement(todo) {
  const template = document.getElementById('childItemTemplate');
  const clone = template.content.cloneNode(true);
  const itemEl = clone.querySelector('.todo-child');

  itemEl.dataset.id = todo.id;
  if (todo.completed) itemEl.classList.add('completed');

  const checkbox = itemEl.querySelector('.todo-checkbox');
  const titleEl = itemEl.querySelector('.todo-title');
  const addChildBtn = itemEl.querySelector('.btn-add-child');
  const editBtn = itemEl.querySelector('.btn-edit');
  const deleteBtn = itemEl.querySelector('.btn-delete');

  checkbox.checked = todo.completed ? 1 : 0;
  titleEl.textContent = todo.title;

  // 复选框事件
  checkbox.addEventListener('change', async () => {
    await api.updateTodo(todo.id, { completed: checkbox.checked ? 1 : 0 });
    itemEl.classList.toggle('completed', checkbox.checked);
  });

  // 添加子条目按钮（暂不支持三级嵌套）
  // addChildBtn.addEventListener('click', () => {
  //   showAddChildForm(todo.id);
  // });

  // 编辑按钮
  editBtn.addEventListener('click', () => {
    showEditForm(todo.id, todo.title);
  });

  // 删除按钮
  deleteBtn.addEventListener('click', async () => {
    if (confirm('确定要删除这个条目吗？')) {
      await api.deleteTodo(todo.id);
      loadAllData();
    }
  });

  return itemEl;
}

// ==================== 拖拽功能 ====================

// 设置 TODO 条目的拖拽
function setupTodoDragAndDrop(itemEl, todo) {
  itemEl.setAttribute('draggable', true);
  itemEl.addEventListener('dragstart', (e) => {
    draggedItem = { item: itemEl, todo };
    itemEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todo.id.toString());
  });

  itemEl.addEventListener('dragend', () => {
    itemEl.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.category-container, .todo-pool, .todo-list').forEach(el => {
      el.classList.remove('drag-over');
    });
  });
}

// 设置分类容器的拖拽接收
function setupCategoryDropTarget(containerEl, category) {
  containerEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (draggedItem) {
      containerEl.classList.add('drag-over');
    }
  });

  containerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  containerEl.addEventListener('dragleave', (e) => {
    if (!containerEl.contains(e.relatedTarget)) {
      containerEl.classList.remove('drag-over');
    }
  });

  containerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    containerEl.classList.remove('drag-over');

    if (draggedItem) {
      const sourceTodo = draggedItem.todo;
      const targetCategoryId = parseInt(containerEl.dataset.categoryId);

      // 更新条目的分类
      await api.updateTodo(sourceTodo.id, {
        category_id: targetCategoryId,
        parent_id: null  // 清除父级关联，作为分类的根条目
      });

      loadAllData();
    }
  });
}

// 设置 POOL 的拖拽接收（允许将条目拖回 POOL）
function setupPoolDropTarget(poolContainerEl) {
  poolContainerEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (draggedItem) {
      console.log('dragenter POOL');
      poolContainerEl.classList.add('drag-over');
    }
  });

  poolContainerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  poolContainerEl.addEventListener('dragleave', (e) => {
    if (!poolContainerEl.contains(e.relatedTarget)) {
      console.log('dragleave POOL');
      poolContainerEl.classList.remove('drag-over');
    }
  });

  poolContainerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    poolContainerEl.classList.remove('drag-over');

    if (draggedItem) {
      const sourceTodo = draggedItem.todo;
      console.log('drop to POOL:', sourceTodo);

      // 更新条目的分类为 POOL
      await api.updateTodo(sourceTodo.id, {
        category_id: DEFAULT_CATEGORY_ID,
        parent_id: null
      });

      loadAllData();
    }
  });
}

// 高亮匹配文本
function highlightMatch(text, searchTerm) {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// 转义正则表达式特殊字符
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== 弹窗表单 ====================
let modalCallback = null;

function showModal(title, defaultValue, callback) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalInput = document.getElementById('modalInput');
  const btnClose = document.getElementById('btnClose');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');

  modalTitle.textContent = title;
  modalInput.value = defaultValue || '';
  modalCallback = callback;

  modal.classList.add('show');
  modalInput.focus();

  const closeModal = () => {
    modal.classList.remove('show');
    modalCallback = null;
  };

  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;
  btnConfirm.onclick = () => {
    const value = modalInput.value.trim();
    if (value) {
      modalCallback(value);
    }
    closeModal();
  };

  modalInput.onkeypress = (e) => {
    if (e.key === 'Enter') btnConfirm.click();
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

// 显示编辑表单
function showEditForm(id, currentTitle) {
  showModal('修改条目', currentTitle, async (value) => {
    await api.updateTodo(id, { title: value });
    loadAllData();
  });
}

// 添加子条目
function showAddChildForm(parentId, categoryId) {
  showModal('添加子条目', '', async (value) => {
    await api.createTodo({
      title: value,
      parent_id: parentId,
      category_id: categoryId
    });
    loadAllData();
  });
}

// 添加待办到分类
function showAddTodoToCategory(categoryId, categoryName) {
  showModal(`添加待办 - ${categoryName}`, '', async (value) => {
    await api.createTodo({
      title: value,
      category_id: categoryId,
      parent_id: null
    });
    loadAllData();
  });
}

// 编辑分类
function showEditCategoryForm(id, currentName) {
  showModal('修改分类', currentName, async (value) => {
    await api.updateCategory(id, { name: value });
    loadAllData();
  });
}

// ==================== 数据加载 ====================
async function loadAllData() {
  // 加载所有分类
  allCategories = await api.getCategories();

  // 加载每个分类下的 TODO
  categoryTodos = {};
  for (const category of allCategories) {
    categoryTodos[category.id] = await api.getTodos(category.id);
  }

  // 渲染 POOL 列表
  const poolList = document.getElementById('poolList');
  renderPoolList(poolList);

  // 渲染待办列表（分类列表）
  const todoList = document.getElementById('todoList');
  renderCategoryList(todoList, searchQuery);
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  const addPoolTodoBtn = document.getElementById('addPoolTodo');
  const poolTitle = document.getElementById('poolTitle');
  const addDateBtn = document.getElementById('addDateBtn');
  const searchCategoryInput = document.getElementById('searchCategoryInput');

  poolTitle.value = '';
  searchCategoryInput.value = '';

  // 添加 POOL 条目
  addPoolTodoBtn.addEventListener('click', async () => {
    const title = poolTitle.value.trim();
    if (!title) return;

    await api.createTodo({
      title,
      category_id: DEFAULT_CATEGORY_ID
    });

    poolTitle.value = '';
    loadAllData();
  });

  // 添加分类 - 使用弹窗
  addDateBtn.addEventListener('click', () => {
    showModal('添加分类', '', async (name) => {
      const existing = allCategories.find(c => c.name === name);
      if (existing) {
        alert('该分类已存在');
        return;
      }
      await api.createCategory(name);
      loadAllData();
    });
  });

  // 搜索分类 - 输入时实时搜索
  searchCategoryInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    loadAllData();
  });

  // 初始加载
  loadAllData();
});
