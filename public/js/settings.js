// ==================== 设置管理 ====================

let currentSettings = {
  background_type: 'color',
  background_color: '#f5f5f5',
  background_image: ''
};

// DOM 元素
const bgTypeRadios = document.querySelectorAll('input[name="backgroundType"]');
const colorSetting = document.getElementById('colorSetting');
const imageSetting = document.getElementById('imageSetting');
const bgColorPicker = document.getElementById('bgColorPicker');
const uploadArea = document.getElementById('uploadArea');
const bgImageInput = document.getElementById('bgImageInput');
const uploadPreview = document.getElementById('uploadPreview');
const previewImage = document.getElementById('previewImage');
const deleteImageBtn = document.getElementById('deleteImageBtn');
const bgPreview = document.getElementById('bgPreview');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

// 加载当前设置
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      currentSettings = {
        background_type: data.data.background_type || 'color',
        background_color: data.data.background_color || '#f5f5f5',
        background_image: data.data.background_image || ''
      };
      applySettingsToUI();
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 应用设置到 UI
function applySettingsToUI() {
  // 设置背景类型
  bgTypeRadios.forEach(radio => {
    radio.checked = radio.value === currentSettings.background_type;
  });
  toggleSettingDisplay(currentSettings.background_type);

  // 设置颜色
  bgColorPicker.value = currentSettings.background_color;

  // 设置图片
  if (currentSettings.background_image) {
    showImagePreview(`/backgrounds/${currentSettings.background_image}`);
  } else {
    hideImagePreview();
  }

  // 更新预览
  updatePreview();
}

// 切换显示颜色/图片设置
function toggleSettingDisplay(type) {
  if (type === 'color') {
    colorSetting.style.display = 'block';
    imageSetting.style.display = 'none';
  } else {
    colorSetting.style.display = 'none';
    imageSetting.style.display = 'block';
  }
}

// 显示图片预览
function showImagePreview(src) {
  previewImage.src = src;
  uploadPreview.style.display = 'flex';
  uploadArea.querySelector('.upload-placeholder').style.display = 'none';
}

// 隐藏图片预览
function hideImagePreview() {
  uploadPreview.style.display = 'none';
  uploadArea.querySelector('.upload-placeholder').style.display = 'block';
}

// 更新背景预览
function updatePreview() {
  bgPreview.innerHTML = '';
  bgPreview.style.background = '';
  bgPreview.style.backgroundImage = '';

  if (currentSettings.background_type === 'color') {
    bgPreview.style.backgroundColor = currentSettings.background_color;
    bgPreview.textContent = '纯色背景预览';
  } else if (currentSettings.background_image) {
    bgPreview.style.backgroundImage = `url(/backgrounds/${currentSettings.background_image})`;
    bgPreview.textContent = '图片背景预览';
  } else {
    bgPreview.textContent = '请先选择或上传图片';
  }
}

// 上传图片
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/settings/background-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      currentSettings.background_image = data.filename;
      showImagePreview(`/backgrounds/${data.filename}`);
      updatePreview();
    } else {
      alert('上传失败：' + data.error);
    }
  } catch (error) {
    alert('上传失败：' + error.message);
  }
}

// 保存设置
async function saveSettings() {
  // 获取背景类型
  bgTypeRadios.forEach(radio => {
    if (radio.checked) {
      currentSettings.background_type = radio.value;
    }
  });

  // 获取颜色值
  currentSettings.background_color = bgColorPicker.value;

  // 如果是纯色类型，清空图片设置
  if (currentSettings.background_type === 'color') {
    currentSettings.background_image = '';
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSettings)
    });
    const data = await res.json();
    if (data.success) {
      alert('设置已保存');
      // 通知所有页面刷新背景（通过 localStorage 事件）
      localStorage.setItem('settingsChanged', Date.now());
    }
  } catch (error) {
    alert('保存失败：' + error.message);
  }
}

// 重置设置
async function resetSettings() {
  if (!confirm('确定要重置为默认设置吗？')) return;

  currentSettings = {
    background_type: 'color',
    background_color: '#f5f5f5',
    background_image: ''
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSettings)
    });
    const data = await res.json();
    if (data.success) {
      applySettingsToUI();
      alert('已重置为默认设置');
      localStorage.setItem('settingsChanged', Date.now());
    }
  } catch (error) {
    alert('重置失败：' + error.message);
  }
}

// 事件监听
bgTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    toggleSettingDisplay(e.target.value);
    updatePreview();
  });
});

bgColorPicker.addEventListener('input', (e) => {
  currentSettings.background_color = e.target.value;
  if (currentSettings.background_type === 'color') {
    updatePreview();
  }
});

// 点击上传区域
uploadArea.addEventListener('click', () => {
  bgImageInput.click();
});

bgImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadImage(file);
  }
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    uploadImage(file);
  } else {
    alert('请上传图片文件');
  }
});

// 删除图片
deleteImageBtn.addEventListener('click', () => {
  currentSettings.background_image = '';
  hideImagePreview();
  updatePreview();
});

// 保存按钮
saveBtn.addEventListener('click', saveSettings);

// 重置按钮
resetBtn.addEventListener('click', resetSettings);

// 初始化
loadSettings();
