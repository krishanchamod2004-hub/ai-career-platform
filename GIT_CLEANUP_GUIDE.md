# 🧹 Git Repository Cleanup & Push Guide

## Problem
Your repository has grown to ~4GB due to accidentally committed `node_modules`, build folders, and local development files (`.local/`, `.dev/` PostgreSQL installations).

## Solution
Follow these steps to clean up your Git history and push only the necessary code to GitHub.

---

## ⚠️ Important Notes

1. **Backup First**: This process rewrites Git history. Create a backup:
   ```powershell
   # Create a complete backup of your project
   xcopy D:\ReactJapp D:\ReactJapp_backup\ /E /I /H
   ```

2. **Collaborators**: If others have cloned this repo, they'll need to re-clone after you force push.

3. **Timing**: This process might take 5-15 minutes depending on your repo size.

---

## 📋 Step-by-Step Commands

### Step 1: Navigate to Your Project
```powershell
cd D:\ReactJapp
```

---

### Step 2: Check Current Repository Size
```powershell
# See what files Git is tracking
git ls-files | wc -l

# Check .git folder size (PowerShell)
(Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB
```

---

### Step 3: Verify .gitignore is Updated
```powershell
# Show the new .gitignore content
cat .gitignore
```

The updated `.gitignore` now includes:
- ✅ `node_modules/`
- ✅ `.next/`, `dist/`, `build/`
- ✅ `.local/` (PostgreSQL data)
- ✅ `.dev/` (development services)
- ✅ `*.log` files
- ✅ `.env` files (keeps `.env.example`)
- ✅ `uploads/` (user data)

---

### Step 4: Remove Tracked Files from Git (WITHOUT Deleting from Disk)
```powershell
# Remove all files from Git's tracking (doesn't delete from disk)
git rm -r --cached .

# Add everything back using the new .gitignore rules
git add .

# Check what will be committed
git status
```

**What this does:**
- `git rm -r --cached .` — Removes everything from Git's index but keeps files on your disk
- `git add .` — Re-adds only files NOT in `.gitignore`
- Files like `node_modules/`, `.local/`, `.dev/` will now be ignored

---

### Step 5: Create a Commit with the Clean State
```powershell
git commit -m "chore: clean repository - remove node_modules, build artifacts, and local dev files"
```

---

### Step 6: (OPTIONAL) Remove Large Files from Git History

If you've already pushed `node_modules` to GitHub in previous commits, you need to purge them from history:

#### Option A: Using git filter-repo (Recommended, Fastest)

**Install git-filter-repo first:**
```powershell
# Using pip (requires Python)
pip install git-filter-repo

# OR download from: https://github.com/newren/git-filter-repo/releases
```

**Run the cleanup:**
```powershell
# Backup your remote URL (filter-repo removes it)
git remote -v > remote-backup.txt

# Remove specific folders from entire history
git filter-repo --path node_modules --invert-paths --force
git filter-repo --path .next --invert-paths --force
git filter-repo --path dist --invert-paths --force
git filter-repo --path build --invert-paths --force
git filter-repo --path .local --invert-paths --force
git filter-repo --path .dev --invert-paths --force
git filter-repo --path apps/api/uploads --invert-paths --force

# Re-add your remote (filter-repo removes it for safety)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

#### Option B: Using BFG Repo-Cleaner (Alternative)

```powershell
# Download BFG from: https://rtyley.github.io/bfg-repo-cleaner/
# Place bfg.jar in D:\ReactJapp

# Clone a fresh mirror
cd D:\
git clone --mirror https://github.com/YOUR_USERNAME/YOUR_REPO.git repo-mirror.git
cd repo-mirror.git

# Delete folders from history
java -jar D:\ReactJapp\bfg.jar --delete-folders node_modules
java -jar D:\ReactJapp\bfg.jar --delete-folders .next
java -jar D:\ReactJapp\bfg.jar --delete-folders dist
java -jar D:\ReactJapp\bfg.jar --delete-folders build
java -jar D:\ReactJapp\bfg.jar --delete-folders .local
java -jar D:\ReactJapp\bfg.jar --delete-folders .dev

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push the cleaned repo
git push
```

#### Option C: Start Fresh (Nuclear Option - Simplest)

If your commit history isn't important:

```powershell
# Remove .git folder
rm -rf .git

# Initialize a fresh repo
git init

# Add all files (using the new .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit: AI Career Platform - Clean codebase"

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push (will replace everything on GitHub)
git push -u origin main --force
```

---

### Step 7: Push to GitHub

#### If you cleaned history (Option A or B):
```powershell
# Force push (rewrites GitHub history)
git push origin main --force

# Or if your default branch is 'master'
git push origin master --force
```

#### If you used Step 4-5 only (no history cleanup):
```powershell
# Normal push
git push origin main

# Or for first push
git push -u origin main
```

---

### Step 8: Verify the Cleanup

```powershell
# Check repository size again
(Get-ChildItem .git -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

# Verify tracked files (should be much fewer now)
git ls-files | wc -l

# Ensure ignored files are not tracked
git status --ignored
```

---

## 🎯 Expected Results

### Before Cleanup:
- Repository size: ~4GB
- Tracked files: 50,000+ files
- Includes: `node_modules/`, `.local/pgsql.zip` (338MB × 2), build folders

### After Cleanup:
- Repository size: ~10-50MB
- Tracked files: ~200-500 files
- Only source code, configs, docs

---

## 🔒 For Fresh Installs (Other Developers)

After cleanup, teammates can clone and set up:

```powershell
# Clone the repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install dependencies (this is what pnpm/npm is for!)
pnpm install

# Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Run migrations
pnpm --filter=@ai-career/api run prisma:migrate:deploy
pnpm --filter=@ai-career/api run prisma:seed

# Start development
pnpm dev
```

---

## 🆘 Troubleshooting

### Problem: "Failed to push - remote has changes"
```powershell
# Pull first, then push
git pull origin main --rebase
git push origin main
```

### Problem: "fatal: refusing to merge unrelated histories"
```powershell
# Allow unrelated histories (use with caution)
git pull origin main --allow-unrelated-histories
```

### Problem: GitHub still shows large repo size
- GitHub needs time to recalculate size (can take 24-48 hours)
- Contact GitHub Support to request garbage collection: support@github.com

### Problem: "git filter-repo not found"
```powershell
# Install with pip
pip install git-filter-repo

# Or download directly
# https://github.com/newren/git-filter-repo/releases
```

---

## 📝 What Files ARE Being Committed Now?

After cleanup, your repo will include:

✅ **Source Code:**
- `apps/api/src/`
- `apps/web/src/`
- `packages/shared/src/`

✅ **Configuration:**
- `package.json`, `pnpm-workspace.yaml`
- `tsconfig.json`, `.eslintrc.js`
- `docker-compose.yml`
- `.env.example` files

✅ **Documentation:**
- `README.md`
- `*.md` guides

✅ **Database Schema:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`

❌ **Excluded (now in .gitignore):**
- `node_modules/` (reinstall with `pnpm install`)
- `.next/`, `dist/`, `build/` (regenerated on build)
- `.local/`, `.dev/` (local dev tools)
- `*.log` files
- `.env` (secrets stay local)
- `uploads/` (user data)

---

## 🚀 Quick Command Summary

```powershell
# Navigate to project
cd D:\ReactJapp

# Clean Git cache
git rm -r --cached .
git add .
git commit -m "chore: clean repository - remove large files and build artifacts"

# Push to GitHub
git push origin main

# OR if you need to clean history (recommended):
pip install git-filter-repo
git remote -v > remote-backup.txt
git filter-repo --path node_modules --invert-paths --force
git filter-repo --path .local --invert-paths --force
git filter-repo --path .dev --invert-paths --force
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push origin main --force
```

---

## ✅ Checklist

- [ ] Backup project folder
- [ ] Update `.gitignore` (already done ✓)
- [ ] Remove cached files: `git rm -r --cached .`
- [ ] Re-add files: `git add .`
- [ ] Commit changes
- [ ] (Optional) Clean history with `git filter-repo`
- [ ] Force push to GitHub
- [ ] Verify repository size on GitHub
- [ ] Test clone on another machine
- [ ] Notify collaborators to re-clone

---

## 📧 Need Help?

If you encounter issues, provide:
1. Git command output
2. Current repo size: `du -sh .git`
3. Branch name: `git branch --show-current`

Good luck! 🎉
