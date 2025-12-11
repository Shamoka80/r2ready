# Script to get JWT token by logging in
param(
    [Parameter(Mandatory=$false)]
    [string]$Email,
    
    [Parameter(Mandatory=$false)]
    [string]$Password
)

Write-Host "🔐 JWT Token Retriever" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# If credentials not provided, prompt for them
if (-not $Email) {
    $Email = Read-Host "Enter your email"
}

if (-not $Password) {
    $securePassword = Read-Host "Enter your password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "`n🔄 Logging in..." -ForegroundColor Yellow

$loginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json
    
    if ($result.token) {
        Write-Host "`n✅ Login successful!" -ForegroundColor Green
        Write-Host "`n📋 User Information:" -ForegroundColor Cyan
        Write-Host "   Name: $($result.user.firstName) $($result.user.lastName)" -ForegroundColor White
        Write-Host "   Email: $($result.user.email)" -ForegroundColor White
        Write-Host "   Role: $($result.user.role)" -ForegroundColor White
        
        Write-Host "`n🔑 Your JWT Token:" -ForegroundColor Cyan
        Write-Host $result.token -ForegroundColor Yellow
        Write-Host "`n💡 Copy the token above to use in API requests." -ForegroundColor Gray
        Write-Host "   Example: Authorization: Bearer $($result.token.Substring(0, 20))..." -ForegroundColor DarkGray
        
        # Save token to variable for easy access
        $global:JWT_TOKEN = $result.token
        Write-Host "`n✅ Token saved to `$global:JWT_TOKEN variable" -ForegroundColor Green
        Write-Host "   Use `$global:JWT_TOKEN in your PowerShell session" -ForegroundColor DarkGray
        
        return $result.token
    } else {
        Write-Host "`n❌ No token in response" -ForegroundColor Red
        Write-Host "Response: $($response.Content)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nResponse details:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Red
    }
    
    exit 1
}




