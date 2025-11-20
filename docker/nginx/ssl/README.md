# SSL 证书目录

此目录用于存放 SSL/TLS 证书文件。

## 生产环境 SSL 证书设置

### 方式 1: 使用 Let's Encrypt（推荐）

1. 安装 Certbot:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot

# macOS
brew install certbot
```

2. 获取证书:
```bash
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

3. 复制证书到此目录:
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./fullchain.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./privkey.pem
```

4. 设置权限:
```bash
chmod 644 fullchain.pem
chmod 600 privkey.pem
```

### 方式 2: 使用自签名证书（仅用于开发/测试）

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
```

## 证书自动续期

Let's Encrypt 证书有效期为 90 天，需要定期续期：

```bash
# 测试续期
sudo certbot renew --dry-run

# 设置自动续期（crontab）
0 0 1 * * sudo certbot renew --quiet && docker-compose -f docker-compose.prod.yml restart nginx
```

## 文件说明

- `fullchain.pem`: 完整证书链（包括服务器证书和中间证书）
- `privkey.pem`: 私钥文件

## 安全注意事项

- 私钥文件 (`privkey.pem`) 应该被妥善保管，不应提交到版本控制系统
- 建议权限设置为 600（仅所有者可读写）
- 定期更新证书，避免过期
