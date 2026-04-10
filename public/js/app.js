// ==================== 状态管理 ====================
let allCategories = [];     // 所有分类
let categoryTodos = {};     // 每个分类下的 TODO { categoryId: todos[] }
let editingId = null;
let draggedItem = null;     // 当前拖动的条目
let searchQuery = '';       // 搜索关键词

// 默认分类 ID（Pool）
const DEFAULT_CATEGORY_ID = 1;

// ==================== 辅助函数 ====================
// 递归获取所有子条目 ID
function getAllChildIds(parentId, todos) {
  const childIds = [];
  const children = todos.filter(t => t.parent_id === parentId);

  children.forEach(child => {
    childIds.push(child.id);
    // 递归获取子条目的子条目
    const grandchildren = getAllChildIds(child.id, todos);
    childIds.push(...grandchildren);
  });

  return childIds;
}

// ==================== 展开/收起状态管理 ====================
// 从 localStorage 获取收起的分类 ID 列表
function getCollapsedCategories() {
  const stored = localStorage.getItem('collapsedCategories');
  return stored ? JSON.parse(stored) : [];
}

// 保存收起状态到 localStorage
function saveCollapsedCategories(collapsedIds) {
  localStorage.setItem('collapsedCategories', JSON.stringify(collapsedIds));
}

// 检查分类是否收起
function isCollapsed(categoryId) {
  const collapsed = getCollapsedCategories();
  return collapsed.includes(categoryId);
}

// 切换分类展开/收起状态
function toggleCategoryCollapse(categoryId) {
  const collapsed = getCollapsedCategories();
  const index = collapsed.indexOf(categoryId);

  if (index > -1) {
    // 已收起，展开它（从数组中移除）
    collapsed.splice(index, 1);
  } else {
    // 已展开，收起它（添加到数组）
    collapsed.push(categoryId);
  }

  saveCollapsedCategories(collapsed);
}

// ==================== API 请求封装 ====================
const api = {
  // 获取所有分类
  async getCategories() {
    const res = await fetch('/api/categories');
    const data = await res.json();
    return data.success ? data.data : [];
  },

  // 创建分类
  async createCategory(name, is_date = false) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, is_date })
    });
    const data = await res.json();
    return data.success ? data.data : null;
  },

  // 归档分类
  async archiveCategory(id) {
    const res = await fetch(`/api/categories/${id}/archive`, {
      method: 'POST'
    });
    const data = await res.json();
    return data.success;
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

  // 更新分类顺序
  async reorderCategories(order) {
    const res = await fetch('/api/categories/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });
    const data = await res.json();
    return data.success;
  },

  // 批量更新 TODO 顺序
  async reorderTodos(items) {
    const res = await fetch('/api/todos/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
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
  if (isCollapsed(category.id)) {
    div.classList.add('collapsed');
  }
  div.dataset.categoryId = category.id;
  div.dataset.categoryName = category.name;

  const header = document.createElement('div');
  header.className = 'category-header';

  // 日期类型标识
  const dateBadge = category.is_date ? '<span class="date-badge" title="日期类型">📅</span>' : '';

  // 归档按钮（仅日期类型分类显示）
  const archiveButton = category.is_date
    ? '<button class="btn-archive-category" title="归档分类">📦</button>'
    : '';

  header.innerHTML = `
    <div class="category-header-left">
      <button class="btn-sm btn-collapse-toggle" title="${isCollapsed(category.id) ? '展开' : '收起'}">${isCollapsed(category.id) ? '▶' : '▼'}</button>
      ${dateBadge}
      <span class="category-name">${highlightMatch(category.name, searchTerm)}</span>
    </div>
    <div class="category-actions">
      <button class="btn-edit-category" title="编辑分类">✏️</button>
      <button class="btn-add-todo" title="添加待办">➕</button>
      ${archiveButton}
      <button class="btn-delete-category" title="删除分类">🗑️</button>
    </div>
  `;

  // 展开/收起切换按钮
  header.querySelector('.btn-collapse-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCategoryCollapse(category.id);
    loadAllData();
  });

  // 阻止按钮的拖动事件干扰拖拽
  header.querySelector('.btn-collapse-toggle').addEventListener('dragstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // 编辑分类按钮
  header.querySelector('.btn-edit-category').addEventListener('click', () => {
    showEditCategoryForm(category.id, category.name, category.is_date);
  });

  // 添加待办按钮
  header.querySelector('.btn-add-todo').addEventListener('click', () => {
    showAddTodoToCategory(category.id, category.name);
  });

  // 归档分类按钮（仅日期类型分类显示）
  const archiveBtn = header.querySelector('.btn-archive-category');
  if (archiveBtn && category.is_date) {
    archiveBtn.addEventListener('click', () => {
      const todosInCategory = categoryTodos[category.id] || [];
      const count = todosInCategory.length;
      const message = count > 0
        ? `该分类下的 ${count} 个条目将被移动到历史记录，不再在待办列表显示。`
        : '归档后该分类将不再在待办列表显示。';

      const modal = document.getElementById('modal');
      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.querySelector('.modal-body');
      const modalInput = document.getElementById('modalInput');
      const btnClose = document.getElementById('btnClose');
      const btnCancel = document.getElementById('btnCancel');
      const btnConfirm = document.getElementById('btnConfirm');

      modalTitle.textContent = '归档确认';
      modalInput.value = '';
      modalInput.placeholder = `确定要归档分类 "${category.name}" 吗？\n${message}`;
      modalInput.readOnly = true;
      modalInput.style.border = 'none';
      modalInput.style.fontSize = '14px';
      modalInput.style.padding = '15px';
      modalInput.style.height = '100px';
      modalInput.style.resize = 'none';
      modalInput.style.background = '#f9f9f9';
      btnConfirm.textContent = '确认归档';

      modal.classList.add('show');

      const closeModal = () => {
        modal.classList.remove('show');
        modalInput.readOnly = false;
        modalInput.style.border = '1px solid #ddd';
        modalInput.style.fontSize = '14px';
        modalInput.style.padding = '10px';
        modalInput.style.height = '';
        modalInput.style.resize = '';
        modalInput.style.background = '';
        btnConfirm.textContent = '确定';
      };

      btnClose.onclick = closeModal;
      btnCancel.onclick = closeModal;
      btnConfirm.onclick = async () => {
        await api.archiveCategory(category.id);
        loadAllData();
        closeModal();
      };

      modal.onclick = (e) => {
        if (e.target === modal) closeModal();
      };
    });
  }

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
    const itemEl = createTodoElement(todo, childrenMap[todo.id] || [], false, childrenMap);
    todoList.appendChild(itemEl);
  });

  // 设置分类容器拖拽接收
  setupCategoryDropTarget(div, category, header);
  // 设置 TODO 列表组内拖拽排序
  setupTodoListDropTarget(todoList, category.id);

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
    const itemEl = createTodoElement(todo, childrenMap[todo.id] || [], true, childrenMap);
    container.appendChild(itemEl);
  });

  // 设置 POOL 为拖拽目标
  setupPoolDropTarget(container);
  // 设置 POOL 列表组内拖拽排序
  setupTodoListDropTarget(container, DEFAULT_CATEGORY_ID);
}

// 创建 TODO 元素
function createTodoElement(todo, children = [], isPool = false, childrenMap = {}) {
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

  // 复选框事件（勾选时同步更新所有子条目）
  checkbox.addEventListener('change', async () => {
    const newStatus = checkbox.checked ? 1 : 0;

    // 更新当前条目
    await api.updateTodo(todo.id, { completed: newStatus });
    itemEl.classList.toggle('completed', newStatus);

    // 获取所有子条目 ID 并批量更新
    const cat = categoryTodos[todo.category_id];
    if (cat) {
      // 更新本地状态
      const t = cat.find(x => x.id === todo.id);
      if (t) t.completed = newStatus;

      // 递归获取所有子条目 ID
      const childIds = getAllChildIds(todo.id, cat);

      // 批量更新子条目状态
      for (const childId of childIds) {
        await api.updateTodo(childId, { completed: newStatus });
        // 更新 DOM
        const childEl = document.querySelector(`[data-id="${childId}"]`);
        if (childEl) {
          childEl.classList.toggle('completed', newStatus);
          const childCheckbox = childEl.querySelector('.todo-checkbox');
          if (childCheckbox) childCheckbox.checked = newStatus;
        }
        // 更新本地状态
        const childTodo = cat.find(x => x.id === childId);
        if (childTodo) childTodo.completed = newStatus;
      }
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
      const childEl = createChildElement(child, childrenMap[child.id] || []);
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
function createChildElement(todo, children = []) {
  const template = document.getElementById('childItemTemplate');
  const clone = template.content.cloneNode(true);
  const itemEl = clone.querySelector('.todo-child');

  itemEl.dataset.id = todo.id;
  itemEl.dataset.categoryId = todo.category_id;
  if (todo.completed) itemEl.classList.add('completed');

  const checkbox = itemEl.querySelector('.todo-checkbox');
  const titleEl = itemEl.querySelector('.todo-title');
  const addChildBtn = itemEl.querySelector('.btn-add-child');
  const editBtn = itemEl.querySelector('.btn-edit');
  const deleteBtn = itemEl.querySelector('.btn-delete');
  const childrenList = itemEl.querySelector('.children-list');

  checkbox.checked = todo.completed ? 1 : 0;
  titleEl.textContent = todo.title;

  // 复选框事件（勾选时同步更新所有子条目）
  checkbox.addEventListener('change', async () => {
    const newStatus = checkbox.checked ? 1 : 0;

    // 更新当前条目
    await api.updateTodo(todo.id, { completed: newStatus });
    itemEl.classList.toggle('completed', newStatus);

    // 获取所有子条目 ID 并批量更新
    const cat = categoryTodos[todo.category_id];
    if (cat) {
      // 递归获取所有子条目 ID
      const childIds = getAllChildIds(todo.id, cat);

      // 批量更新子条目状态
      for (const childId of childIds) {
        await api.updateTodo(childId, { completed: newStatus });
        // 更新 DOM
        const childEl = document.querySelector(`[data-id="${childId}"]`);
        if (childEl) {
          childEl.classList.toggle('completed', newStatus);
          const childCheckbox = childEl.querySelector('.todo-checkbox');
          if (childCheckbox) childCheckbox.checked = newStatus;
        }
        // 更新本地状态
        const childTodo = cat.find(x => x.id === childId);
        if (childTodo) childTodo.completed = newStatus;
      }
    }
  });

  // 添加子条目按钮（支持三级嵌套）
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

  // 渲染子条目（三级）
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

  // 子条目也支持拖拽
  itemEl.setAttribute('draggable', true);
  setupTodoDragAndDrop(itemEl, todo);

  return itemEl;
}

// ==================== 拖拽功能 ====================

// 设置 TODO 条目的拖拽
function setupTodoDragAndDrop(itemEl, todo) {
  itemEl.setAttribute('draggable', true);
  itemEl.addEventListener('dragstart', (e) => {
    draggedItem = { type: 'todo', item: itemEl, todo };
    itemEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'todo', id: todo.id }));
  });

  itemEl.addEventListener('dragend', () => {
    itemEl.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.todo-item, .todo-child').forEach(el => {
      el.classList.remove('drag-over');
    });
  });

  // 移除条目之间的拖放功能（不再支持将一个条目变成另一个条目的子条目）
  // 只保留拖动到分类容器进行排序和移动分类的功能
}

// 设置 TODO 列表容器的拖拽接收（用于组内排序）
function setupTodoListDropTarget(containerEl, categoryId) {
  containerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    // 检查拖动位置是否在 TODO 列表区域内（而不是分类头部）
    // 分类头部的高度约为 40-50px，所以如果 y 坐标小于容器顶部 + 60，说明在头部附近
    const todoListRect = containerEl.getBoundingClientRect();
    const isNearHeader = e.clientY < todoListRect.top + 60;

    // 如果在头部附近，不阻止冒泡，让头部元素处理
    if (draggedItem && draggedItem.type === 'todo' && isNearHeader) {
      // 不调用 stopPropagation，让事件冒泡到头部
      return;
    }

    // 只在拖动 TODO 条目且在列表区域内时阻止冒泡（组内排序）
    if (draggedItem && draggedItem.type === 'todo') {
      e.stopPropagation();
    }
  });

  containerEl.addEventListener('drop', async (e) => {
    e.preventDefault();

    // 只在拖动 TODO 条目时处理
    if (draggedItem && draggedItem.type === 'todo') {
      const sourceCategoryId = draggedItem.todo.category_id;
      const sourceTodo = draggedItem.todo;

      // 检查拖动位置是否在列表顶部（靠近头部）
      const rect = containerEl.getBoundingClientRect();
      const isNearTop = e.clientY < rect.top + 30;

      // 如果是在列表顶部且拖动的是子条目（有 parent_id），则清空 parent_id 并移动到该分类
      if (isNearTop && sourceTodo.parent_id) {
        e.stopPropagation();

        await api.updateTodo(sourceTodo.id, {
          category_id: categoryId,
          parent_id: null
        });

        loadAllData();
        return;
      }

      // 如果是跨分类拖动，让事件冒泡到分类容器处理
      if (sourceCategoryId !== categoryId) {
        return;
      }

      e.stopPropagation();

      const draggedEl = draggedItem.item;
      const afterElement = getDragAfterElement(containerEl, e.clientY);

      // 获取新顺序
      if (afterElement == null) {
        containerEl.appendChild(draggedEl);
      } else {
        containerEl.insertBefore(draggedEl, afterElement);
      }

      // 获取该容器内所有 TODO 的新顺序（只包括直接子元素）
      const todoElements = containerEl.querySelectorAll(':scope > .todo-item');
      const items = [];
      todoElements.forEach((el, index) => {
        const id = parseInt(el.dataset.id);
        items.push({ id, sort_order: index });
      });

      // 更新后端排序
      await api.reorderTodos(items);
      loadAllData();
    }
    // 如果是跨分类拖动或分类拖动，让事件冒泡到父元素（分类容器）处理
  });
}

// 获取拖动位置后的元素（只考虑直接子元素）
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(':scope > .todo-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 设置分类容器的拖拽接收
function setupCategoryDropTarget(containerEl, category, headerEl) {
  // 设置分类头部可拖动
  headerEl.setAttribute('draggable', 'true');
  headerEl.addEventListener('dragstart', (e) => {
    draggedItem = { type: 'category', category, element: containerEl };
    containerEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'category', id: category.id }));
  });

  headerEl.addEventListener('dragend', () => {
    containerEl.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.category-container, .todo-pool, .todo-list').forEach(el => {
      el.classList.remove('drag-over');
      el.style.borderTop = '';
      el.style.borderBottom = '';
    });
  });

  // 阻止按钮点击事件干扰拖拽
  const buttons = headerEl.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // 分类头部接收 TODO 条目拖放（将条目放入该分类）
  headerEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.type === 'todo') {
      headerEl.classList.add('drag-over-target');
    }
  });

  headerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.type === 'todo') {
      e.dataTransfer.dropEffect = 'move';
    } else if (draggedItem && draggedItem.type === 'category') {
      // 分类之间的拖拽：显示插入位置指示
      const rect = containerEl.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      if (offset > rect.height / 2) {
        containerEl.style.borderBottom = '3px solid #3498db';
        containerEl.style.borderTop = '';
      } else {
        containerEl.style.borderTop = '3px solid #3498db';
        containerEl.style.borderBottom = '';
      }
      e.dataTransfer.dropEffect = 'move';
    }
  });

  headerEl.addEventListener('dragleave', (e) => {
    if (!headerEl.contains(e.relatedTarget)) {
      headerEl.classList.remove('drag-over-target');
    }
  });

  headerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    headerEl.classList.remove('drag-over-target');

    if (!draggedItem) return;

    // 处理 TODO 条目拖放到分类头部（将条目放入该分类）
    if (draggedItem.type === 'todo') {
      const sourceTodo = draggedItem.todo;
      const targetCategoryId = category.id;

      // 更新条目的分类，并清除父级关联（作为分类的根条目）
      await api.updateTodo(sourceTodo.id, {
        category_id: targetCategoryId,
        parent_id: null
      });

      loadAllData();
      return;
    }

    // 处理分类之间的拖拽排序
    if (draggedItem.type === 'category') {
      const sourceCategory = draggedItem.category;
      const targetCategory = category;

      if (sourceCategory.id === targetCategory.id) return;

      const sourceIndex = allCategories.findIndex(c => c.id === sourceCategory.id);
      const targetIndex = allCategories.findIndex(c => c.id === targetCategory.id);

      // 确定插入位置（根据鼠标位置判断是插入到前面还是后面）
      const rect = containerEl.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const insertAfter = offset > rect.height / 2;

      // 从原位置移除
      allCategories.splice(sourceIndex, 1);
      // 插入到新位置
      allCategories.splice(insertAfter ? targetIndex : targetIndex - (sourceIndex < targetIndex ? 1 : 0), 0, sourceCategory);

      // 更新后端排序
      await updateCategoryOrder();
      loadAllData();
    }
  });

  // 容器接收分类之间的拖拽排序和 TODO 条目拖放
  containerEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === 'category') {
      containerEl.classList.add('drag-over');
    }
  });

  containerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === 'category') {
      // 分类之间的拖拽：显示插入位置指示
      const rect = containerEl.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      if (offset > rect.height / 2) {
        containerEl.style.borderBottom = '3px solid #3498db';
        containerEl.style.borderTop = '';
      } else {
        containerEl.style.borderTop = '3px solid #3498db';
        containerEl.style.borderBottom = '';
      }
      e.dataTransfer.dropEffect = 'move';
    } else if (draggedItem && draggedItem.type === 'todo') {
      // TODO 条目拖放：显示整体高亮
      containerEl.classList.add('drag-over');
    }
  });

  containerEl.addEventListener('dragleave', (e) => {
    if (!containerEl.contains(e.relatedTarget)) {
      containerEl.classList.remove('drag-over');
      containerEl.style.borderTop = '';
      containerEl.style.borderBottom = '';
    }
  });

  containerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    containerEl.classList.remove('drag-over');
    containerEl.style.borderTop = '';
    containerEl.style.borderBottom = '';

    if (!draggedItem) return;

    // 处理分类之间的拖拽排序
    if (draggedItem.type === 'category') {
      const sourceCategory = draggedItem.category;
      const targetCategory = category;

      if (sourceCategory.id === targetCategory.id) return;

      const sourceIndex = allCategories.findIndex(c => c.id === sourceCategory.id);
      const targetIndex = allCategories.findIndex(c => c.id === targetCategory.id);

      // 确定插入位置（根据鼠标位置判断是插入到前面还是后面）
      const rect = containerEl.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const insertAfter = offset > rect.height / 2;

      // 从原位置移除
      allCategories.splice(sourceIndex, 1);
      // 插入到新位置
      allCategories.splice(insertAfter ? targetIndex : targetIndex - (sourceIndex < targetIndex ? 1 : 0), 0, sourceCategory);

      // 更新后端排序
      await updateCategoryOrder();
      loadAllData();
      return;
    }

    // 处理 TODO 条目拖放到分类容器（将条目放入该分类）
    if (draggedItem.type === 'todo') {
      const sourceTodo = draggedItem.todo;
      const targetCategoryId = category.id;

      // 更新条目的分类，并清除父级关联（作为分类的根条目）
      await api.updateTodo(sourceTodo.id, {
        category_id: targetCategoryId,
        parent_id: null
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
      poolContainerEl.classList.add('drag-over');
    }
  });

  poolContainerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  poolContainerEl.addEventListener('dragleave', (e) => {
    if (!poolContainerEl.contains(e.relatedTarget)) {
      poolContainerEl.classList.remove('drag-over');
    }
  });

  poolContainerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    poolContainerEl.classList.remove('drag-over');

    if (draggedItem) {
      const sourceTodo = draggedItem.todo;

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

// 根据 ID 查找 todo
function findTodoById(id) {
  for (const categoryId in categoryTodos) {
    const todo = categoryTodos[categoryId].find(t => t.id === id);
    if (todo) return todo;
  }
  return null;
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

// 显示添加分类弹窗（支持日期类型选项）
function showAddCategoryForm() {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalInput = document.getElementById('modalInput');
  const btnClose = document.getElementById('btnClose');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');
  const modalBody = document.querySelector('.modal-body');

  modalTitle.textContent = '添加分类';
  modalInput.value = '';
  modalInput.placeholder = '请输入分类名称';

  // 添加日期类型选项
  let checkboxHtml = `
    <div style="margin-top: 15px; display: flex; align-items: center; gap: 8px;">
      <input type="checkbox" id="isDateCheckbox" style="width: auto;">
      <label for="isDateCheckbox" style="font-size: 14px;">日期类型（如：2026-04-07）</label>
    </div>
  `;

  // 移除已存在的 checkbox（如果有）
  const existingCheckbox = modalBody.querySelector('#isDateCheckbox');
  if (existingCheckbox) {
    existingCheckbox.parentElement.remove();
  }
  modalBody.insertAdjacentHTML('beforeend', checkboxHtml);

  modal.classList.add('show');
  modalInput.focus();

  const closeModal = () => {
    modal.classList.remove('show');
    const checkbox = modalBody.querySelector('#isDateCheckbox');
    if (checkbox) checkbox.parentElement.remove();
  };

  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;
  btnConfirm.onclick = () => {
    const name = modalInput.value.trim();
    const is_date = document.getElementById('isDateCheckbox').checked;
    if (name) {
      const existing = allCategories.find(c => c.name === name);
      if (existing) {
        alert('该分类已存在');
        return;
      }
      api.createCategory(name, is_date).then(() => {
        loadAllData();
      });
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

// 显示编辑表单（显示 ID 和允许设置 parent_id）
function showEditForm(id, currentTitle) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalInput = document.getElementById('modalInput');
  const btnClose = document.getElementById('btnClose');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');
  const modalBody = document.querySelector('.modal-body');

  // 查找当前 TODO
  let currentTodo = null;
  for (const catId of Object.keys(categoryTodos)) {
    const found = categoryTodos[catId].find(t => t.id === id);
    if (found) {
      currentTodo = found;
      break;
    }
  }

  if (!currentTodo) {
    alert('条目不存在');
    return;
  }

  modalTitle.textContent = '修改条目';
  modalInput.value = currentTitle || '';
  modalInput.placeholder = '请输入标题';

  // 构建 HTML
  let extraHtml = `
    <div style="margin-top: 15px; font-size: 14px; color: #666;">
      <strong>ID:</strong> ${id}
    </div>
  `;

  // 添加 parent_id 设置（文本框）
  extraHtml += `
    <div style="margin-top: 15px;">
      <label style="display: block; font-size: 14px; margin-bottom: 8px;">父级条目 ID（留空表示无父级）:</label>
      <input type="number" id="parentIdInput" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" placeholder="输入父级条目 ID" value="${currentTodo.parent_id || ''}">
    </div>
  `;

  modalBody.innerHTML = `
    <input type="text" id="modalInput" class="modal-input" placeholder="请输入标题..." value="${(currentTitle || '').replace(/"/g, '&quot;')}">
    ${extraHtml}
  `;
  const newModalInput = document.getElementById('modalInput');

  modal.classList.add('show');
  newModalInput.focus();

  const closeModal = () => {
    modal.classList.remove('show');
  };

  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;
  btnConfirm.onclick = () => {
    const value = newModalInput.value.trim();
    const parentIdValue = document.getElementById('parentIdInput').value;
    const newParentId = parentIdValue ? parseInt(parentIdValue) : null;

    if (value) {
      api.updateTodo(id, {
        title: value,
        parent_id: newParentId
      }).then(() => {
        loadAllData();
      });
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
function showEditCategoryForm(id, currentName, isDate = false) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalInput = document.getElementById('modalInput');
  const btnClose = document.getElementById('btnClose');
  const btnCancel = document.getElementById('btnCancel');
  const btnConfirm = document.getElementById('btnConfirm');
  const modalBody = document.querySelector('.modal-body');

  modalTitle.textContent = '修改分类';
  modalInput.value = currentName;
  modalInput.placeholder = '请输入分类名称';

  // 添加日期类型选项
  let checkboxHtml = `
    <div style="margin-top: 15px; display: flex; align-items: center; gap: 8px;">
      <input type="checkbox" id="isDateCheckbox" style="width: auto;" ${isDate ? 'checked' : ''}>
      <label for="isDateCheckbox" style="font-size: 14px;">日期类型</label>
    </div>
  `;

  // 移除已存在的 checkbox（如果有）
  const existingCheckbox = modalBody.querySelector('#isDateCheckbox');
  if (existingCheckbox) {
    existingCheckbox.parentElement.remove();
  }
  modalBody.insertAdjacentHTML('beforeend', checkboxHtml);

  modal.classList.add('show');
  modalInput.focus();

  const closeModal = () => {
    modal.classList.remove('show');
    const checkbox = modalBody.querySelector('#isDateCheckbox');
    if (checkbox) checkbox.parentElement.remove();
  };

  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;
  btnConfirm.onclick = () => {
    const name = modalInput.value.trim();
    const is_date = document.getElementById('isDateCheckbox').checked;
    if (name) {
      api.updateCategory(id, { name, is_date }).then(() => {
        loadAllData();
      });
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

// 更新分类顺序
async function updateCategoryOrder() {
  // 过滤掉 Pool 分类（ID=1），只排序用户创建的分类
  const order = allCategories
    .filter(c => c.id !== DEFAULT_CATEGORY_ID)
    .map(c => c.id);

  if (order.length > 0) {
    await api.reorderCategories(order);
  }
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

// ==================== 展开/收起全部 ====================
function expandAll() {
  saveCollapsedCategories([]);
  loadAllData();
}

function collapseAll() {
  // 过滤掉 Pool 分类，收起所有其他分类
  const allCollapsed = allCategories
    .filter(c => c.id !== DEFAULT_CATEGORY_ID)
    .map(c => c.id);
  saveCollapsedCategories(allCollapsed);
  loadAllData();
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  const addPoolTodoBtn = document.getElementById('addPoolTodo');
  const poolTitle = document.getElementById('poolTitle');
  const addDateBtn = document.getElementById('addDateBtn');
  const searchCategoryInput = document.getElementById('searchCategoryInput');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');

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
    showAddCategoryForm();
  });

  // 搜索分类 - 输入时实时搜索
  searchCategoryInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    loadAllData();
  });

  // 全部展开
  expandAllBtn.addEventListener('click', expandAll);

  // 全部收起
  collapseAllBtn.addEventListener('click', collapseAll);

  // 加载背景设置
  loadBackgroundSettings();

  // 监听设置变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'settingsChanged') {
      loadBackgroundSettings();
    }
  });

  // 初始加载
  loadAllData();
});

// ==================== 背景设置 ====================
async function loadBackgroundSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      const settings = data.data || {};
      const bgType = settings.background_type || 'color';
      const bgColor = settings.background_color || '#f5f5f5';
      const bgImage = settings.background_image || '';

      if (bgType === 'image' && bgImage) {
        document.body.style.setProperty('--bg-image', `url(/backgrounds/${bgImage})`);
        document.body.style.setProperty('--bg-color', 'transparent');
      } else {
        document.body.style.setProperty('--bg-image', 'none');
        document.body.style.setProperty('--bg-color', bgColor);
      }
    }
  } catch (error) {
    console.error('加载背景设置失败:', error);
  }
}
