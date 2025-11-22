# Deployment Guide: Bohemian Heat Map to Netlify

This guide walks you through deploying the Bohemian Heat Map to Netlify via GitHub.

## Prerequisites

- ✅ GitHub account (you have this)
- ✅ Netlify account (you have this)
- ✅ Git installed on your computer
- ✅ Node.js installed (for running the data fetch script)

## Step-by-Step Deployment

### Step 1: Initialize Git Repository (if not already done)

Open Terminal in your project folder and run:

```bash
cd ~/Desktop/Projects/Coding/cursor-bohemian-heat-map
git init
git add .
git commit -m "Initial commit: Bohemian Heat Map Portland"
```

### Step 2: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **+** icon in the top right → **New repository**
3. Repository name: `bohemian-heat-map-portland` (or any name you prefer)
4. Description: "Interactive heat map showing bohemian lifestyle businesses in Portland, Oregon"
5. Make it **Public** (or Private if you prefer)
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **Create repository**

### Step 3: Push to GitHub

GitHub will show you commands to run. Use these (replace `YOUR-USERNAME` with your GitHub username):

```bash
git remote add origin https://github.com/YOUR-USERNAME/bohemian-heat-map-portland.git
git branch -M main
git push -u origin main
```

You'll be prompted for your GitHub username and password (use a Personal Access Token if you have 2FA enabled).

### Step 4: Deploy to Netlify

1. Go to [Netlify.com](https://netlify.com) and log in
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub** as your Git provider
4. Authorize Netlify to access your GitHub account (if first time)
5. Select your repository: `bohemian-heat-map-portland`
6. Configure build settings:
   - **Branch to deploy**: `main`
   - **Build command**: (leave empty - no build needed!)
   - **Publish directory**: `/` (root directory)
7. Click **Deploy site**

### Step 5: Configure Netlify (Optional Settings)

Once deployed, you can:

1. **Change site name**: Click **Site settings** → **Change site name**
   - Choose something like `bohemian-heat-map-portland` or `portland-bohemian-map`

2. **Custom domain** (optional): If you have a domain, go to **Domain settings** → **Add custom domain**

3. **Force HTTPS**: Should be automatic on Netlify

### Step 6: Update Data Periodically

When you want to update the business data:

1. Run the fetch script locally:
   ```bash
   cd ~/Desktop/Projects/Coding/cursor-bohemian-heat-map
   node fetch-data.js
   ```

2. Commit and push the updated `businesses-data.json`:
   ```bash
   git add businesses-data.json
   git commit -m "Update business data - [date]"
   git push
   ```

3. Netlify will automatically redeploy with the new data!

## Important Files for Deployment

These files **must** be in your repository:
- ✅ `index.html`
- ✅ `app.js`
- ✅ `styles.css`
- ✅ `businesses-data.json` (the cached data file)
- ✅ All other project files

## Netlify Configuration (Optional)

If you want to ensure specific settings, you can create a `netlify.toml` file (optional):

```toml
[build]
  publish = "."
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Troubleshooting

**Build fails:**
- Make sure `businesses-data.json` is committed to the repository
- Check that all required files are present

**Site loads but shows errors:**
- Check browser console for errors
- Verify `businesses-data.json` is accessible (try visiting `yoursite.netlify.app/businesses-data.json`)

**Data doesn't update after pushing:**
- Check Netlify deploy logs
- Verify the file was committed correctly

## Quick Reference Commands

```bash
# Update data
node fetch-data.js

# Commit and push updates
git add businesses-data.json
git commit -m "Update data - [date]"
git push

# Check deployment status
# Visit your Netlify dashboard
```

## Next Steps After Deployment

1. ✅ Share your site URL
2. ✅ Test on mobile devices
3. ✅ Set up automatic updates (monthly reminders to run fetch script)
4. ✅ Consider adding analytics (Netlify Analytics or Google Analytics)

Your site will be live at: `https://your-site-name.netlify.app`

