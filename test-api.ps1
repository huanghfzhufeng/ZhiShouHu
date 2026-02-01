# API连接测试脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API 连接测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 测试1: 后端健康检查
Write-Host "[测试1] 后端健康检查..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -Method Get
    Write-Host "✓ 后端健康检查成功" -ForegroundColor Green
    Write-Host "  响应: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ 后端健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 测试2: 通过Nginx代理访问后端
Write-Host "[测试2] 通过Nginx代理访问后端..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost/api/health" -Method Get
    Write-Host "✓ Nginx代理工作正常" -ForegroundColor Green
    Write-Host "  响应: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Nginx代理失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 测试3: 登录测试
Write-Host "[测试3] 测试登录..." -ForegroundColor Yellow
try {
    $loginData = @{
        phone = "13800000002"
        password = "123456"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    Write-Host "✓ 登录成功" -ForegroundColor Green
    Write-Host "  Token: $($response.access_token.Substring(0, 20))..." -ForegroundColor Gray
    
    $token = $response.access_token
    
    # 测试4: 获取用户信息
    Write-Host ""
    Write-Host "[测试4] 获取用户信息..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $userInfo = Invoke-RestMethod -Uri "http://localhost/api/auth/me" -Method Get -Headers $headers
    Write-Host "✓ 获取用户信息成功" -ForegroundColor Green
    Write-Host "  用户: $($userInfo.username)" -ForegroundColor Gray
    Write-Host "  角色: $($userInfo.role)" -ForegroundColor Gray
    Write-Host "  监护老人ID: $($userInfo.elder_id)" -ForegroundColor Gray
    
    # 测试5: 获取老人实时状态
    if ($userInfo.elder_id) {
        Write-Host ""
        Write-Host "[测试5] 获取老人实时状态..." -ForegroundColor Yellow
        $status = Invoke-RestMethod -Uri "http://localhost/api/realtime-status/$($userInfo.elder_id)" -Method Get -Headers $headers
        Write-Host "✓ 获取老人实时状态成功" -ForegroundColor Green
        Write-Host "  状态: $($status.status)" -ForegroundColor Gray
        Write-Host "  心率: $($status.heartRate) bpm" -ForegroundColor Gray
        Write-Host "  血压: $($status.bloodPressure)" -ForegroundColor Gray
        Write-Host "  位置: $($status.location)" -ForegroundColor Gray
        Write-Host "  风险等级: $($status.riskLevel)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ 测试失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "现在可以访问 http://localhost 进行测试" -ForegroundColor Green
Write-Host "测试账号: 13800000002 / 123456" -ForegroundColor Green
