#!/bin/bash

# 生产环境部署脚本
# 用途: 部署 Wordle Server 到生产环境

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必需的命令
check_requirements() {
    log_info "检查系统要求..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    log_info "系统要求检查通过"
}

# 检查环境变量文件
check_env_file() {
    log_info "检查环境变量配置..."

    if [ ! -f .env.production.local ]; then
        log_error ".env.production.local 文件不存在"
        log_warn "请复制 .env.production 并配置正确的值："
        log_warn "  cp .env.production .env.production.local"
        log_warn "  nano .env.production.local"
        exit 1
    fi

    # 检查必需的环境变量
    source .env.production.local

    if [ "$POSTGRES_PASSWORD" == "CHANGE_ME_STRONG_PASSWORD" ]; then
        log_error "请修改 POSTGRES_PASSWORD 为强密码"
        exit 1
    fi

    if [ "$ADMIN_SECRET" == "CHANGE_ME_USE_GENERATE_SECRETS_SCRIPT" ]; then
        log_error "请修改 ADMIN_SECRET，运行: npm run generate:secrets"
        exit 1
    fi

    if [ "$ENCRYPTION_SECRET" == "CHANGE_ME_USE_GENERATE_SECRETS_SCRIPT" ]; then
        log_error "请修改 ENCRYPTION_SECRET，运行: npm run generate:secrets"
        exit 1
    fi

    log_info "环境变量配置检查通过"
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."

    BACKUP_DIR="./backups"
    mkdir -p "$BACKUP_DIR"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/wordle_db_backup_$TIMESTAMP.sql"

    if docker ps | grep -q wordle-postgres-prod; then
        docker exec wordle-postgres-prod pg_dump -U postgres wordle_db > "$BACKUP_FILE"
        log_info "数据库备份完成: $BACKUP_FILE"
    else
        log_warn "数据库容器未运行，跳过备份"
    fi
}

# 构建镜像
build_images() {
    log_info "构建 Docker 镜像..."

    docker-compose -f docker-compose.prod.yml build --no-cache

    log_info "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    docker-compose -f docker-compose.prod.yml --env-file .env.production.local up -d

    log_info "等待服务启动..."
    sleep 10

    log_info "服务已启动"
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."

    docker-compose -f docker-compose.prod.yml exec -T app npm run migrate:up

    log_info "数据库迁移完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    MAX_RETRIES=30
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f -s http://localhost:${APP_PORT:-3000}/health/live > /dev/null; then
            log_info "健康检查通过！"
            return 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_warn "健康检查失败，重试 $RETRY_COUNT/$MAX_RETRIES..."
        sleep 2
    done

    log_error "健康检查失败，服务可能未正常启动"
    docker-compose -f docker-compose.prod.yml logs app
    exit 1
}

# 显示状态
show_status() {
    log_info "服务状态："
    docker-compose -f docker-compose.prod.yml ps

    echo ""
    log_info "部署完成！"
    log_info "访问地址: http://localhost:${APP_PORT:-3000}"
    log_info "健康检查: http://localhost:${APP_PORT:-3000}/health"
    log_info ""
    log_info "查看日志: docker-compose -f docker-compose.prod.yml logs -f"
    log_info "停止服务: docker-compose -f docker-compose.prod.yml down"
}

# 主函数
main() {
    log_info "开始部署 Wordle Server 生产环境..."
    echo ""

    check_requirements
    check_env_file

    # 询问是否备份
    if docker ps | grep -q wordle-postgres-prod; then
        read -p "是否备份现有数据库？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            backup_database
        fi
    fi

    build_images
    start_services
    run_migrations
    health_check
    show_status
}

# 执行主函数
main "$@"
