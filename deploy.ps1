# TripSplit deployment script
# 1. Creates/updates GitHub repository
# 2. Deploys to Vercel

Write-Host "=== TripSplit Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check if repo exists on GitHub
Write-Host "Step 1: Push to GitHub..." -ForegroundColor Yellow
git branch -M main 2>&1 | Out-Null

# Try to add remote (will fail if already exists, that's ok)
git remote add origin https://github.com/ashok9847/trip-expenditure.git 2>&1 | Out-Null

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push -u origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Code pushed to GitHub successfully!" -ForegroundColor Green
    Write-Host "  View at: https://github.com/ashok9847/trip-expenditure" -ForegroundColor Cyan
} else {
    Write-Host "✗ GitHub push failed. Make sure you've created the repo at:" -ForegroundColor Red
    Write-Host "  https://github.com/new" -ForegroundColor Yellow
    Write-Host "  Name it 'trip-expenditure' and make it public (no README/gitignore)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Deploy to Vercel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Install Vercel CLI if needed:" -ForegroundColor Cyan
Write-Host "  npm install -g vercel" -ForegroundColor White
Write-Host ""
Write-Host "Then deploy:" -ForegroundColor Cyan
Write-Host "  vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Or link from Vercel dashboard:" -ForegroundColor Cyan
Write-Host "  1. Go to https://vercel.com/new" -ForegroundColor White
Write-Host "  2. Import from GitHub: ashok9847/trip-expenditure" -ForegroundColor White
Write-Host "  3. Framework: Vite" -ForegroundColor White
Write-Host "  4. Add environment variables from .env.local" -ForegroundColor White
Write-Host "  5. Deploy!" -ForegroundColor White
Write-Host ""
Write-Host "Remember to add your Vercel URL to Supabase Authentication settings!" -ForegroundColor Yellow
