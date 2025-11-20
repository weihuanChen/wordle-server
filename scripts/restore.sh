#!/bin/bash

# 数据库恢复脚本
# 用途: 从备份恢复 PostgreSQL 数据库

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
if [ $# -eq 0 ]; then
    log_error "请指定备份文件路径"
    echo "用法: $0 <backup_file>"
    echo "示例: $0 backups/wordle_db_backup_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "备份文件不存在: $BACKUP_FILE"
    exit 1
fi

# 检查容器是否运行
if ! docker ps | grep -q wordle-postgres-prod; then
    log_error "PostgreSQL 容器未运行"
    exit 1
fi

log_warn "警告：此操作将覆盖现有数据库！"
read -p "确定要恢复数据库吗？(yes/no) " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    log_info "操作已取消"
    exit 0
fi

log_info "开始恢复数据库..."

# 停止应用服务
log_info "停止应用服务..."
docker-compose -f docker-compose.prod.yml stop app

# 恢复数据库
log_info "恢复数据库从: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | docker exec -i wordle-postgres-prod pg_restore -U postgres -d wordle_db -c

if [ $? -eq 0 ]; then
    log_info "数据库恢复成功"
else
    log_error "数据库恢复失败"
    exit 1
fi

# 重启应用服务
log_info "重启应用服务..."
docker-compose -f docker-compose.prod.yml start app

log_info "恢复完成"
