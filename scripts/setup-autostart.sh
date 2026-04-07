#!/bin/bash
# TODO Web 应用 - Ubuntu 开机自启动配置脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="todo-web"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "================================"
echo "TODO Web 应用 - 自启动配置工具"
echo "================================"
echo ""

# 检查是否以 root 运行
check_root() {
  if [ "$EUID" -ne 0 ]; then
    echo "错误：请使用 sudo 运行此脚本"
    echo "用法：sudo $0 [install|uninstall|status|start|stop|restart]"
    exit 1
  fi
}

# 安装服务
install_service() {
  echo "正在安装服务..."

  # 创建服务文件
  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=TODO Web Application
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Environment=PORT=8210
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

  echo "服务文件已创建：$SERVICE_FILE"

  # 重载 systemd
  systemctl daemon-reload

  # 启用服务
  systemctl enable ${SERVICE_NAME}
  echo "服务已启用开机自启动"

  # 启动服务
  systemctl start ${SERVICE_NAME}
  echo "服务已启动"

  echo ""
  echo "================================"
  echo "安装完成！"
  echo "================================"
  echo "服务状态：systemctl status ${SERVICE_NAME}"
  echo "查看日志：journalctl -u ${SERVICE_NAME} -f"
  echo "停止服务：systemctl stop ${SERVICE_NAME}"
  echo "启动服务：systemctl start ${SERVICE_NAME}"
  echo "重启服务：systemctl restart ${SERVICE_NAME}"
  echo "禁用服务：systemctl disable ${SERVICE_NAME}"
}

# 卸载服务
uninstall_service() {
  echo "正在卸载服务..."

  # 停止服务
  systemctl stop ${SERVICE_NAME} 2>/dev/null

  # 禁用服务
  systemctl disable ${SERVICE_NAME} 2>/dev/null

  # 删除服务文件
  rm -f "$SERVICE_FILE"

  # 重载 systemd
  systemctl daemon-reload

  echo "服务已卸载"
}

# 显示状态
show_status() {
  systemctl status ${SERVICE_NAME}
}

# 启动服务
start_service() {
  systemctl start ${SERVICE_NAME}
  echo "服务已启动"
}

# 停止服务
stop_service() {
  systemctl stop ${SERVICE_NAME}
  echo "服务已停止"
}

# 重启服务
restart_service() {
  systemctl restart ${SERVICE_NAME}
  echo "服务已重启"
}

# 主逻辑
check_root

case "${1:-install}" in
  install)
    install_service
    ;;
  uninstall)
    uninstall_service
    ;;
  status)
    show_status
    ;;
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    restart_service
    ;;
  *)
    echo "用法：$0 {install|uninstall|status|start|stop|restart}"
    exit 1
    ;;
esac

exit 0
