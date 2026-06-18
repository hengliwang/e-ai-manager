#!/bin/bash

# ================================
# 一键启动 / 重启前后端服务
# ================================

# 项目根目录
PROJECT_DIR="/root/e-ai-manager"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 日志存放目录
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

# PID 文件
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

# ---------- 停止服务函数 ----------
stop_service() {
    local pid_file=$1
    local service_name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "🛑  停止 $service_name (PID: $pid)"
            kill -15 "$pid"          # 优雅关闭
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid"       # 强制关闭
                echo "   ⚠️  强制终止 $service_name"
            fi
        else
            echo "   ℹ️  $service_name 进程已不存在"
        fi
        rm -f "$pid_file"
    else
        echo "   ℹ️  未找到 $service_name 的 PID 文件，跳过"
    fi
}

# ---------- 停止已有服务 ----------
echo "🧹 清理旧服务..."
stop_service "$BACKEND_PID_FILE" "后端"
stop_service "$FRONTEND_PID_FILE" "前端"

# ---------- 启动后端 ----------
# ---------- 启动后端 ----------
echo ""
echo "🚀  启动后端..."
cd "$BACKEND_DIR" || { echo "❌  后端目录不存在"; exit 1; }

# 使用绝对路径激活虚拟环境，然后运行 main.py
nohup bash -c "python main.py" \
    > "$LOG_DIR/backend.log" 2>&1 &

BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE"
echo "   ✅  后端 PID: $BACKEND_PID，日志: $LOG_DIR/backend.log"

# ---------- 启动前端 ----------
echo ""
echo "🚀  启动前端..."
cd "$FRONTEND_DIR" || { echo "❌  前端目录不存在"; exit 1; }

# 检查 npm 是否存在
if ! command -v npm &> /dev/null; then
    echo "❌  npm 未安装，请先安装 Node.js 和 npm"
    exit 1
fi

nohup npm run dev \
    > "$LOG_DIR/frontend.log" 2>&1 &

FRONTEND_PID=$!
echo $FRONTEND_PID > "$FRONTEND_PID_FILE"
echo "   ✅  前端 PID: $FRONTEND_PID，日志: $LOG_DIR/frontend.log"

echo ""
echo "🎉  所有服务已启动！"
echo "查看后端日志：tail -f $LOG_DIR/backend.log"
echo "查看前端日志：tail -f $LOG_DIR/frontend.log"                                                                                                                           1,11          To
