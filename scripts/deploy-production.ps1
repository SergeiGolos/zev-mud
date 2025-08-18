# Production deployment script for Windows PowerShell

param(
    [string]$Domain = "localhost",
    [switch]$GenerateCerts = $false,
    [switch]$SkipBuild = $false
)

Write-Host "Starting production deployment for domain: $Domain" -ForegroundColor Green

# Create necessary directories
$directories = @("./data", "./logs", "./certs", "./data/ranvier", "./data/areas", "./data/bundles", "./logs/ranvier", "./logs/proxy", "./logs/web", "./logs/nginx")
foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force
        Write-Host "Created directory: $dir" -ForegroundColor Yellow
    }
}

# Generate SSL certificates if requested
if ($GenerateCerts) {
    Write-Host "Generating SSL certificates..." -ForegroundColor Yellow
    
    # Check if OpenSSL is available
    try {
        openssl version | Out-Null
    } catch {
        Write-Error "OpenSSL is not available. Please install OpenSSL or provide your own certificates."
        exit 1
    }
    
    # Generate private key
    openssl genrsa -out "./certs/key.pem" 2048
    
    # Create certificate configuration
    $certConfig = @"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Organization
CN = $Domain

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $Domain
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"@
    
    $certConfig | Out-File -FilePath "./certs/cert.conf" -Encoding ASCII
    
    # Generate certificate
    openssl req -new -x509 -key "./certs/key.pem" -out "./certs/cert.pem" -days 365 -config "./certs/cert.conf" -extensions v3_req
    
    # Clean up
    Remove-Item "./certs/cert.conf"
    
    Write-Host "SSL certificates generated successfully" -ForegroundColor Green
}

# Copy environment configuration
if (!(Test-Path ".env")) {
    Copy-Item ".env.production" ".env"
    Write-Host "Created .env file from .env.production template" -ForegroundColor Yellow
    Write-Host "Please review and customize the .env file for your deployment" -ForegroundColor Cyan
}

# Build and start services
if (!$SkipBuild) {
    Write-Host "Building Docker images..." -ForegroundColor Yellow
    docker-compose build --no-cache
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
}

Write-Host "Starting production services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "Production deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services are running on:" -ForegroundColor Cyan
    Write-Host "  Web Client: http://localhost:3001" -ForegroundColor White
    Write-Host "  WebSocket Proxy: ws://localhost:8080" -ForegroundColor White
    Write-Host "  Ranvier Server: telnet://localhost:3000" -ForegroundColor White
    Write-Host "  Nginx (if configured): http://localhost:80, https://localhost:443" -ForegroundColor White
    Write-Host ""
    Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Cyan
    Write-Host "To stop services: docker-compose down" -ForegroundColor Cyan
} else {
    Write-Error "Production deployment failed"
    exit 1
}