# 使用 Node.js LTS 版本
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装构建工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建数据目录（用于 SQLite 数据库）
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8210

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8210

# 启动应用
CMD ["node", "server.js"]
