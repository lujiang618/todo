# TODO Web API 接口文档

**基础地址**: `http://localhost:8210/api`

---

## 目录

1. [健康检查](#健康检查)
2. [分类管理](#分类管理)
3. [TODO 管理](#todo-管理)
4. [归档管理](#归档管理)
5. [设置管理](#设置管理)

---

## 健康检查

### GET /health

**说明**: 检查服务是否正常运行

**响应示例**:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-04-08T01:47:48.540Z"
}
```

---

## 分类管理

### GET /api/categories

**说明**: 获取所有分类（排除已归档）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Pool",
      "is_date": false,
      "archived": false,
      "sort_order": 0,
      "created_at": "2026-04-07 06:48:06"
    },
    {
      "id": 2,
      "name": "2026-04-07",
      "is_date": true,
      "archived": false,
      "sort_order": 1,
      "created_at": "2026-04-07 06:48:06"
    }
  ]
}
```

---

### POST /api/categories

**说明**: 创建新分类

**请求体**:
```json
{
  "name": "工作",
  "is_date": false,
  "sort_order": 2
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 分类名称 |
| is_date | boolean | 否 | 是否为日期类型，默认 false |
| sort_order | integer | 否 | 排序顺序，默认 0 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "工作",
    "is_date": false,
    "archived": false,
    "sort_order": 2,
    "created_at": "2026-04-08 01:00:00"
  }
}
```

**错误响应**:
- 400: `Category name already exists` - 分类名称已存在

---

### PUT /api/categories/reorder

**说明**: 批量更新分类顺序

**请求体**:
```json
{
  "order": [2, 3, 1]
}
```

**参数说明**:
| 参数 | 类型 | 说明 |
|------|------|------|
| order | array | 分类 ID 数组，按期望的顺序排列 |

**响应示例**:
```json
{
  "success": true
}
```

---

### PUT /api/categories/:id

**说明**: 更新分类信息

**请求体**:
```json
{
  "name": "新分类名",
  "is_date": true
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 新分类名称 |
| is_date | boolean | 否 | 是否为日期类型 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "新分类名",
    "is_date": true,
    "archived": false,
    "sort_order": 1,
    "created_at": "2026-04-07 06:48:06",
    "updated_at": "2026-04-08 01:00:00"
  }
}
```

---

### POST /api/categories/:id/archive

**说明**: 归档分类（仅日期类型），归档后分类被标记为已归档，该分类下的所有 TODO 保存到归档表

**响应示例**:
```json
{
  "success": true
}
```

**错误响应**:
- 404: `Category not found` - 分类不存在

---

### DELETE /api/categories/:id

**说明**: 删除分类及其下的所有 TODO

**响应示例**:
```json
{
  "success": true
}
```

---

## TODO 管理

### GET /api/todos

**说明**: 获取所有 TODO，可按分类过滤

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| category_id | integer | 分类 ID，不传则获取所有分类的 TODO |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "学习 Node.js",
      "description": null,
      "completed": 0,
      "parent_id": null,
      "category_id": 1,
      "date": null,
      "sort_order": 0,
      "created_at": "2026-04-07 06:48:06",
      "updated_at": "2026-04-07 06:48:06"
    },
    {
      "id": 2,
      "title": "完成第一章",
      "description": null,
      "completed": 1,
      "parent_id": 1,
      "category_id": 1,
      "date": null,
      "sort_order": 0,
      "created_at": "2026-04-07 06:48:06",
      "updated_at": "2026-04-07 06:48:06"
    }
  ]
}
```

---

### GET /api/todos/:id

**说明**: 获取单个 TODO 详情

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "学习 Node.js",
    "description": null,
    "completed": 0,
    "parent_id": null,
    "category_id": 1,
    "date": null,
    "sort_order": 0,
    "created_at": "2026-04-07 06:48:06",
    "updated_at": "2026-04-07 06:48:06"
  }
}
```

**错误响应**:
- 404: `TODO not found` - TODO 不存在

---

### POST /api/todos

**说明**: 创建新 TODO

**请求体**:
```json
{
  "title": "学习 Node.js",
  "description": "完成第一章阅读",
  "parent_id": null,
  "category_id": 1,
  "sort_order": 0
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | TODO 标题 |
| description | string | 否 | 描述 |
| parent_id | integer | 否 | 父级 TODO ID，用于创建子条目 |
| category_id | integer | 否 | 分类 ID，默认为 1（Pool） |
| sort_order | integer | 否 | 排序顺序，默认 0 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "title": "学习 Node.js",
    "description": "完成第一章阅读",
    "completed": 0,
    "parent_id": null,
    "category_id": 1,
    "sort_order": 0,
    "created_at": "2026-04-08 01:00:00",
    "updated_at": "2026-04-08 01:00:00"
  }
}
```

---

### PUT /api/todos/reorder

**说明**: 批量更新 TODO 顺序

**请求体**:
```json
{
  "items": [
    { "id": 1, "sort_order": 0 },
    { "id": 2, "sort_order": 1 },
    { "id": 3, "sort_order": 2 }
  ]
}
```

**参数说明**:
| 参数 | 类型 | 说明 |
|------|------|------|
| items | array | TODO ID 和对应的新排序位置 |

**响应示例**:
```json
{
  "success": true
}
```

---

### PUT /api/todos/:id

**说明**: 更新 TODO

**请求体**:
```json
{
  "title": "新标题",
  "completed": 1
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | 新标题 |
| description | string | 否 | 新描述 |
| completed | boolean | 否 | 完成状态 (0/1) |
| parent_id | integer | 否 | 父级 TODO ID |
| category_id | integer | 否 | 分类 ID |
| sort_order | integer | 否 | 排序顺序 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "新标题",
    "description": null,
    "completed": 1,
    "parent_id": null,
    "category_id": 1,
    "sort_order": 0,
    "created_at": "2026-04-07 06:48:06",
    "updated_at": "2026-04-08 01:00:00"
  }
}
```

---

### DELETE /api/todos/:id

**说明**: 删除 TODO（包括子条目）

**响应示例**:
```json
{
  "success": true
}
```

---

## 归档管理

### GET /api/archives

**说明**: 获取所有归档记录列表

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "year": "2026",
      "month": "04",
      "created_at": "2026-04-07 10:37:43"
    }
  ]
}
```

---

### GET /api/archives/:year/:month

**说明**: 获取指定年月的归档数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "year": "2026",
    "month": "04",
    "data": {
      "category_name": "2026-04-07",
      "todos": [
        {
          "id": 9,
          "title": "通过程序管理 todo",
          "description": null,
          "completed": 1,
          "parent_id": null,
          "category_id": 2,
          "date": null,
          "sort_order": 0,
          "created_at": "2026-04-07 06:48:06",
          "updated_at": "2026-04-07 10:30:59"
        }
      ]
    },
    "created_at": "2026-04-07 10:37:43"
  }
}
```

**错误响应**:
- 404: `Archive not found` - 归档不存在

---

### POST /api/archives/archive

**说明**: 手动触发归档

**请求体**:
```json
{
  "year": "2026",
  "month": "04"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| year | string | 是 | 年份 |
| month | string | 是 | 月份（两位数） |

**响应示例**:
```json
{
  "success": true,
  "message": "Archived 3 todos for 2026-04"
}
```

---

## 设置管理

### GET /api/settings

**说明**: 获取所有设置

**响应示例**:
```json
{
  "success": true,
  "data": {
    "background_type": "image",
    "background_color": "#f5f5f5",
    "background_image": "bg-1712541600000.jpg"
  }
}
```

**设置项说明**:
| 键 | 类型 | 说明 |
|------|------|------|
| background_type | string | 背景类型：`color` 或 `image` |
| background_color | string | 背景颜色（HEX 格式） |
| background_image | string | 背景图片文件名 |

---

### PUT /api/settings

**说明**: 更新设置

**请求体**:
```json
{
  "background_type": "color",
  "background_color": "#3498db",
  "background_image": ""
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| background_type | string | 否 | 背景类型：`color` 或 `image` |
| background_color | string | 否 | 背景颜色（HEX 格式） |
| background_image | string | 否 | 背景图片文件名 |

**响应示例**:
```json
{
  "success": true
}
```

---

### POST /api/settings/background-image

**说明**: 上传背景图片

**请求类型**: `multipart/form-data`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | file | 是 | 图片文件 |

**图片限制**:
- 支持格式：JPG, PNG, GIF, WebP
- 最大大小：10MB
- 存储位置：`data/backgrounds/`

**响应示例**:
```json
{
  "success": true,
  "filename": "bg-1712541600000.jpg"
}
```

**错误响应**:
- 400: `No file uploaded` - 未上传文件
- 400: `只支持图片文件（jpg, png, gif, webp）` - 文件类型不支持

---

## 数据模型

### Category (分类)
```json
{
  "id": 1,
  "name": "Pool",
  "is_date": false,
  "archived": false,
  "sort_order": 0,
  "created_at": "2026-04-07 06:48:06"
}
```

### TODO
```json
{
  "id": 1,
  "title": "学习 Node.js",
  "description": null,
  "completed": 0,
  "parent_id": null,
  "category_id": 1,
  "date": null,
  "sort_order": 0,
  "created_at": "2026-04-07 06:48:06",
  "updated_at": "2026-04-07 06:48:06"
}
```

### Archive (归档)
```json
{
  "id": 1,
  "year": "2026",
  "month": "04",
  "data": {
    "category_name": "2026-04-07",
    "todos": []
  },
  "created_at": "2026-04-07 10:37:43"
}
```

### Settings (设置)
```json
{
  "background_type": "color",
  "background_color": "#f5f5f5",
  "background_image": ""
}
```

---

## 错误处理

所有错误响应格式统一为：
```json
{
  "success": false,
  "error": "错误信息"
}
```

**常见错误码**:
- 400: 请求参数错误
- 404: 资源不存在
- 500: 服务器内部错误
