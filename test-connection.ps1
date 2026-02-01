Write-Host "================================" -ForegroundColor Cyan
Write-Host "API Connection Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Test 1] Backend health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -Method Get
    Write-Host "SUCCESS: Backend is running" -ForegroundColor Green
    Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "[Test 2] Nginx proxy to backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost/api/health" -Method Get
    Write-Host "SUCCESS: Nginx proxy works" -ForegroundColor Green
    Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "[Test 3] Login test..." -ForegroundColor Yellow
try {
    $loginData = @{
        phone = "13800000002"
        password = "123456"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    Write-Host "SUCCESS: Login works" -ForegroundColor Green
    Write-Host "  Token: $($response.access_token.Substring(0, 20))..." -ForegroundColor Gray
    
    $token = $response.access_token
    
    Write-Host ""
    Write-Host "[Test 4] Get user info..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $userInfo = Invoke-RestMethod -Uri "http://localhost/api/auth/me" -Method Get -Headers $headers
    Write-Host "SUCCESS: Got user info" -ForegroundColor Green
    Write-Host "  Username: $($userInfo.username)" -ForegroundColor Gray
    Write-Host "  Role: $($userInfo.role)" -ForegroundColor Gray
    Write-Host "  Elder ID: $($userInfo.elder_id)" -ForegroundColor Gray
    
    if ($userInfo.elder_id) {
        Write-Host ""
        Write-Host "[Test 5] Get elder realtime status..." -ForegroundColor Yellow
        $status = Invoke-RestMethod -Uri "http://localhost/api/realtime-status/$($userInfo.elder_id)" -Method Get -Headers $headers
        Write-Host "SUCCESS: Got realtime status" -ForegroundColor Green
        Write-Host "  Status: $($status.status)" -ForegroundColor Gray
        Write-Host "  Heart Rate: $($status.heartRate) bpm" -ForegroundColor Gray
        Write-Host "  Blood Pressure: $($status.bloodPressure)" -ForegroundColor Gray
        Write-Host "  Location: $($status.location)" -ForegroundColor Gray
        Write-Host "  Risk Level: $($status.riskLevel)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open http://localhost in your browser" -ForegroundColor Green
Write-Host "Login: 13800000002 / 123456" -ForegroundColor Green
