#!/bin/bash
set -e
cd ~/龍蝦PROJECT

echo "[1/5] Cloning stockv1 via HTTPS..."
git clone https://github.com/HKBryanHO/stockv1.git stockv1-git-only

echo "[2/5] Copying .git into asherboy-diary..."
cp -r stockv1-git-only/.git asherboy-diary/.git
rm -rf stockv1-git-only

echo "[3/5] Setting remote URL..."
cd asherboy-diary
git remote set-url origin https://github.com/HKBryanHO/stockv1.git

echo "[4/5] Committing all diary files..."
git add -A
git commit -m "rebuild: Asher Boy autonomous diary bma-hk.com"

echo "[5/5] Force pushing to GitHub..."
git push origin main -f

echo ""
echo "DONE! Diary pushed to GitHub."
