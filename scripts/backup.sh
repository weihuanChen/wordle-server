#!/bin/bash

# 数据库备份脚本
# 用途: 备份生产环境的 PostgreSQL 数据库

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
BACKUP_DIR="./backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/wordle_db_backup_$TIMESTAMP.sql.gz"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查容器是否运行
if ! docker ps | grep -q wordle-postgres-prod; then
    log_error "PostgreSQL 容器未运行"
    exit 1
fi

log_info "开始备份数据库..."

# 执行备份
docker exec wordle-postgres-prod pg_dump -U postgres -F c wordle_db | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log_info "备份成功: $BACKUP_FILE"
    log_info "备份大小: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    log_error "备份失败"
    exit 1
fi

# 清理旧备份
log_info "清理 $RETENTION_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "wordle_db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

log_info "备份完成"
