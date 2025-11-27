# RunRoute Android Deployment Guide

## Overview
Step-by-step guide for deploying RunRoute to Android - from testing on your device to Google Play Store submission.

##  Your Setup
- ✅ Google Play Developer account ready
- 🎯 Android-only deployment (skipping iOS)
- 🗄️ Single Supabase environment (dev & prod)
- 📱 Goal: Test on device → Deploy to Play Store
- 📅 No specific deadline

---

## PHASE 1: Security & Configuration

### Step 1: Secure Google Maps API Key

**Problem:** Your API key is hardcoded in `app.json` - anyone with repo access can see and use it.

**Fix - Part A: Restrict API Key in Google Cloud Console**

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your Google Maps API key
3. Click "Edit API key"

**Set Application Restrictions:**
- Choose "Android apps"
- Click "Add an item"
- Package name: `com.runroute.app`
- SHA-1 fingerprint: Leave blank for now (we'll add this after first build in Phase 4)

**Set API Restrictions:**
- Choose "Restrict key"
- Select ONLY these APIs:
  - Maps SDK for Android
  - Directions API
  - (Places API if you use it)
- Save changes

**Set up Billing Alerts:**
- Go to Billing → Budgets & Alerts
- Create alert at $10, $50 thresholds
- This protects against unauthorized usage

**Fix - Part B: Move API Key to Environment Variable**

You already have the key in `.env.local` - we just need to make `app.json` use it dynamically.

---

### Step 2: Convert app.json to app.config.js

**Why:** To load API key from environment variables instead of hardcoding.

**Create `app.config.js`:**
```javascript
import 'dotenv/config';

export default {
  expo: {
    name: "RunRoute",
    slug: "runroute",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#007AFF"
    },
    android: {
      package: "com.runroute.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#007AFF"
      },
      permissions: [
        "ACCESS_BACKGROUND_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "INTERNET"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "RunRoute needs access to your location to track your runs and show your position on the map.",
          locationAlwaysPermission: "RunRoute needs access to your location in the background to track your runs while the app is not actively in use.",
          locationWhenInUsePermission: "RunRoute needs access to your location to track your runs and show your position on the map."
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "01d855c1-c436-4fda-adc0-b85bc01ea8c4"
      }
    },
    owner: "castbart"
  }
};
```

**Install dotenv:**
```bash
npm install --save-dev dotenv
```

**Delete old `app.json`** after creating `app.config.js`.

---

### Step 3: Verify .gitignore

Ensure these are in `.gitignore` (they should be already):
```
.env
.env*.local
*.keystore
*.jks
```

---

## PHASE 2: Create Privacy Policy Website

**Required by Google Play Store** - you must have a publicly accessible privacy policy URL.

### Option A: GitHub Pages (Recommended - Free & Simple)

**Step 1: Create Repository**
1. Go to GitHub → Create new repository
2. Name: `runroute-privacy` (public)
3. Initialize with README

**Step 2: Create Privacy Policy**
1. In the repo, create `index.html`
2. Copy the template below
3. Replace `[Your Email]` with your contact email
4. Commit the file

**Privacy Policy HTML Template:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RunRoute Privacy Policy</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #FF6B35; }
        h2 { color: #4ECDC4; margin-top: 30px; }
        .last-updated { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>RunRoute Privacy Policy</h1>
    <p class="last-updated">Last Updated: November 25, 2025</p>

    <h2>1. Introduction</h2>
    <p>RunRoute ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.</p>

    <h2>2. Information We Collect</h2>

    <h3>2.1 Location Data</h3>
    <p>RunRoute collects precise location data to provide core functionality:</p>
    <ul>
        <li><strong>During runs:</strong> We track your GPS coordinates to map your route, calculate distance, and measure pace</li>
        <li><strong>Background tracking:</strong> When you start a run, we continue tracking even when the app is minimized to ensure accurate run data</li>
        <li><strong>Route planning:</strong> We use your current location to help plan running routes</li>
    </ul>
    <p>Location data is only collected when you actively use the run tracking or route planning features.</p>

    <h3>2.2 Account Information</h3>
    <p>When you create an account, we collect:</p>
    <ul>
        <li>Email address</li>
        <li>Display name</li>
        <li>Profile photo (optional)</li>
    </ul>

    <h3>2.3 Run Data</h3>
    <p>We store information about your runs:</p>
    <ul>
        <li>Route coordinates and map data</li>
        <li>Distance, duration, pace, and elevation</li>
        <li>Date and time of runs</li>
        <li>Calories burned (estimated)</li>
    </ul>

    <h3>2.4 Social Features</h3>
    <p>If you use our social features:</p>
    <ul>
        <li>Posts and captions you share</li>
        <li>Comments and likes on posts</li>
        <li>Follow relationships with other users</li>
    </ul>

    <h2>3. How We Use Your Information</h2>
    <p>We use your information to:</p>
    <ul>
        <li>Provide core running tracking and route planning features</li>
        <li>Display your run history and analytics</li>
        <li>Enable social sharing and community features</li>
        <li>Improve app performance and user experience</li>
        <li>Send important service updates (if needed)</li>
    </ul>

    <h2>4. Data Storage and Security</h2>
    <p>Your data is stored securely using Supabase, a trusted cloud database provider:</p>
    <ul>
        <li>All data is encrypted in transit using HTTPS/TLS</li>
        <li>Access to your data is protected by authentication</li>
        <li>We implement row-level security to ensure users can only access their own data</li>
    </ul>

    <h2>5. Third-Party Services</h2>
    <p>RunRoute uses the following third-party services:</p>
    <ul>
        <li><strong>Google Maps:</strong> For displaying maps and calculating routes</li>
        <li><strong>Supabase:</strong> For secure data storage and authentication</li>
    </ul>
    <p>These services have their own privacy policies governing their use of data.</p>

    <h2>6. Data Sharing</h2>
    <p>We do not sell your personal data. Your information is shared only:</p>
    <ul>
        <li>With other users when you explicitly share runs via social features</li>
        <li>When required by law or legal process</li>
    </ul>

    <h2>7. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
        <li>Access your personal data</li>
        <li>Delete your account and all associated data</li>
        <li>Export your run data (GPX, CSV formats)</li>
        <li>Control what you share via privacy settings</li>
    </ul>

    <h2>8. Children's Privacy</h2>
    <p>RunRoute is not intended for children under 13. We do not knowingly collect information from children under 13.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this privacy policy from time to time. We will notify you of significant changes by updating the "Last Updated" date.</p>

    <h2>10. Contact Us</h2>
    <p>If you have questions about this privacy policy, please contact us at:</p>
    <p><strong>Email:</strong> [Your Email]</p>

    <hr style="margin-top: 50px;">
    <p style="text-align: center; color: #666; font-size: 14px;">© 2025 RunRoute. All rights reserved.</p>
</body>
</html>
```

**Step 3: Enable GitHub Pages**
1. Go to repo Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `main` → `/root`
4. Save

Your privacy policy will be live at: `https://[your-github-username].github.io/runroute-privacy/`

**Step 4: Update app.config.js**
Add this line in the `expo` object (after `owner`):
```javascript
privacy: "https://[your-github-username].github.io/runroute-privacy/"
```

---

## PHASE 3: EAS Setup

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to EAS
```bash
eas login
```
Use your Expo account (owner: castbart)

### Step 3: Verify Project Configuration
```bash
eas build:configure
```
This ensures your project is linked to EAS (should already be done).

---

## PHASE 4: Build for Testing on Your Phone

### Step 1: Build Preview APK
```bash
eas build --platform android --profile preview
```

**What happens:**
- EAS builds an .apk file
- Takes 10-20 minutes
- You'll get a download link when done
- Preview builds are for internal testing (not Play Store)

### Step 2: While Building - Generate Keystore

During your first `production` build, EAS will prompt you to generate a keystore. Let's do that now:

```bash
eas credentials
```

**Select:**
1. Android
2. production
3. "Set up a new keystore"

EAS will generate and securely store your production keystore.

### Step 3: Get SHA-1 Fingerprint

After keystore is created:
```bash
eas credentials
```
**Select:**
1. Android
2. production
3. "View keystore info" or "Download keystore"

Copy the **SHA-1 fingerprint** - you'll need this for Google Cloud Console (go back to Phase 1, Step 1 and add it to your API key restrictions).

### Step 4: Install APK on Your Phone

Once the preview build finishes:
1. Open the EAS build link on your Android phone
2. Download the .apk file
3. Android will ask for permission to "Install Unknown Apps" - grant it
4. Install and open RunRoute

---

## PHASE 5: Testing Checklist

Test these thoroughly on your physical device:

### Core Features
- [ ] Login/Sign up works
- [ ] Route planning generates routes correctly
- [ ] GPS tracking works (start, pause, resume, stop)
- [ ] Run saves to database
- [ ] Run history displays
- [ ] Analytics screen shows data
- [ ] Social feed loads
- [ ] Can create posts from runs
- [ ] Follow/unfollow works
- [ ] Profile shows correct stats

### Permissions & Background
- [ ] Location permission prompts appear correctly
- [ ] Background location permission requested
- [ ] App continues tracking when minimized
- [ ] App continues tracking when screen is off
- [ ] Run completes successfully after 30+ minutes

### Performance
- [ ] App loads quickly
- [ ] No crashes during normal use
- [ ] Battery usage is reasonable during tracking
- [ ] Maps load and display correctly

---

## PHASE 6: Prepare Store Assets

### 6.1: App Icon & Screenshots

**App Icon:**
- ✅ You already have `./assets/icon.png` (1024x1024)
- Ensure it's exactly 1024x1024 pixels

**Screenshots (Required - minimum 2, recommended 4-8):**

Take screenshots of:
1. Route planning screen (show a route on map)
2. Live GPS tracking (show running stats)
3. Run history/analytics
4. Social feed

**Screenshot Requirements:**
- Minimum 320px on shortest side
- Maximum 3840px on longest side
- Recommended: 1080 x 1920 (phone portrait)
- Format: PNG or JPEG

**How to take screenshots:**
- Run app on your phone
- Use phone's screenshot function
- Transfer to computer

**Optional: Add Device Frames**
- Use [Appifier](https://appifier.site/) or [Device Frames](https://deviceframes.com/) to add phone frames around screenshots
- Makes them look more professional

### 6.2: Feature Graphic (Android Banner)

**Required by Google Play Store**
- Dimensions: 1024 x 500 pixels
- Format: PNG or JPEG
- No transparency

**Quick Option:** Create in Canva
1. Go to [Canva.com](https://www.canva.com/)
2. Custom size: 1024 x 500
3. Use RunRoute colors (#FF6B35, #4ECDC4)
4. Add text: "RunRoute - Plan. Run. Share."
5. Add simple graphics (running icon, route path)
6. Download as PNG

### 6.3: App Description

**Short Description (80 characters):**
```
Plan routes, track runs with GPS, share with friends. Your running companion.
```

**Full Description (up to 4000 characters):**
```
🏃 RunRoute - Your Complete Running Companion

Plan custom routes, track every run with precision GPS, and share your achievements with a community of runners.

PLAN YOUR PERFECT ROUTE 🗺️
• Generate custom routes based on your target distance
• Choose loop routes or point-to-point
• Interactive map with route preview
• Save favorite routes for later

TRACK EVERY RUN 📍
• Real-time GPS tracking with high accuracy
• Live stats: distance, pace, duration, elevation
• Pause and resume tracking
• Automatic run saving to history
• Background tracking keeps going even when you minimize the app

ANALYZE YOUR PERFORMANCE 📊
• Comprehensive run history
• Weekly and monthly analytics
• Personal records tracking (fastest pace, longest run)
• Compare runs side-by-side
• Export data in GPX or CSV format

SHARE WITH THE COMMUNITY 🤝
• Post runs to social feed
• Follow other runners
• Like and comment on posts
• Discover new runners in your area
• Feed filtered by people you follow

KEY FEATURES
✓ Precise GPS tracking with background support
✓ Custom route generator
✓ Run history and analytics
✓ Social feed and community
✓ Export runs (GPX, CSV)
✓ Personal records and achievements
✓ Clean, modern interface

Perfect for runners of all levels - from beginners planning their first 5K to experienced marathoners tracking training.

Download RunRoute today and start running smarter!
```

---

## PHASE 7: Production Build

### Build for Play Store

```bash
eas build --platform android --profile production
```

**What happens:**
- EAS builds an .aab file (Android App Bundle)
- Uses the production keystore you created
- Auto-increments version number
- Takes 10-20 minutes
- You'll get a download link

**Download the .aab file** when build completes - you'll need it for Play Store upload.

---

## PHASE 8: Google Play Store Submission

### Step 1: Access Play Console
1. Go to [Google Play Console](https://play.google.com/console)
2. Sign in with your developer account
3. Click "Create app"

### Step 2: App Details
- **App name:** RunRoute
- **Default language:** English (United States)
- **App or game:** App
- **Free or paid:** Free
- **Declarations:**
  - Check all required boxes (developer program policies, US export laws, etc.)
- Click "Create app"

### Step 3: Set Up App (Dashboard Tasks)

You'll see a checklist. Complete each section:

#### 3a. App Access
- Select: "All functionality is available without special access"
- (Or provide demo account if you want reviewers to use a test account)

#### 3b. Ads
- Select: "No, my app does not contain ads"
- (Unless you've added ads)

#### 3c. Content Rating
1. Click "Start questionnaire"
2. Enter your email
3. Category: **"Utility, Productivity, Communication, or Other"**
4. Answer questions:
   - Does your app contain violence? No
   - Does your app contain sexual content? No
   - Does your app contain language? No
   - Does your app allow users to interact/exchange information? **Yes** (social features)
   - Does your app share user location? **Yes**
5. Submit questionnaire
6. Get rating (likely **Everyone** or **Everyone 10+**)

#### 3d. Target Audience
- **Age:** Select "18 and over" (or "13-17" if targeting younger)
- **Appeal to children:** No

#### 3e. News App
- Select: "No, it's not a news app"

### Step 4: Store Listing

Fill out all fields:

**App Details:**
- **App name:** RunRoute
- **Short description:** (80 chars from Phase 6.3)
- **Full description:** (4000 chars from Phase 6.3)

**Graphics:**
- **App icon:** Upload 512 x 512 PNG (resize your 1024x1024 icon)
- **Feature graphic:** Upload your 1024 x 500 banner
- **Phone screenshots:** Upload 2-8 screenshots (from Phase 6.1)

**Categorization:**
- **App category:** Health & Fitness
- **Tags:** (Optional) running, fitness, GPS, tracking, health

**Contact Details:**
- **Email:** Your support email
- **Website:** (Optional - your GitHub pages URL or leave blank)
- **Phone:** (Optional)

**Privacy Policy:**
- **Privacy policy URL:** Your GitHub Pages URL from Phase 2

### Step 5: Store Settings

**App Availability:**
- **Countries:** Select all countries (or specific ones)

**App Pricing:**
- Select: **Free**

### Step 6: Main Store Listing → Manage Track → Production

1. Go to "Production" track (left sidebar)
2. Click "Create new release"

**Release Details:**
- **Release name:** 1.0.0 (matches your app version)
- **Release notes:**
  ```
  Initial release of RunRoute!

  Features:
  • Plan custom running routes
  • Track runs with GPS
  • View run history and analytics
  • Share runs with community
  • Follow other runners
  ```

**App Bundles:**
- Click "Upload" → Select your .aab file from Phase 7
- Wait for upload to complete (may take a few minutes)
- Google will process and show app details

### Step 7: Data Safety

This is a **required** section.

1. Go to "Data safety" (left sidebar)
2. Click "Start"

**Data Collection:**
- "Does your app collect or share user data?" → **Yes**

**Location Data:**
- **Collected:** Yes
- **Type:** Precise location
- **Purpose:** App functionality (tracking runs)
- **Optional or required:** Required for core functionality
- **Encrypted in transit:** Yes
- **Can users request deletion:** Yes

**Personal Info:**
- **Collected:** Yes
- **Type:** Email address, Name
- **Purpose:** Account management
- **Optional or required:** Required
- **Encrypted in transit:** Yes
- **Can users request deletion:** Yes

**App Activity:**
- **Collected:** Yes
- **Type:** App interactions (runs, posts, etc.)
- **Purpose:** App functionality
- **Optional or required:** Required
- **Encrypted in transit:** Yes
- **Can users request deletion:** Yes

Save data safety form.

### Step 8: Review and Publish

1. Go back to dashboard
2. Ensure all sections have green checkmarks
3. Go to "Production" → "Review release"
4. Review all details carefully
5. Click "Start rollout to Production"

**Confirmation:**
- Google will show a final confirmation
- Click "Rollout"

---

## PHASE 9: Review Process

### What Happens Next

**Review Timeline:**
- Typically 3-7 days for first submission
- You'll get email notifications from Google Play

**Possible Outcomes:**

1. **Approved ✅**
   - App goes live within 24 hours
   - You'll get email confirmation
   - Find your app on Play Store by searching "RunRoute"

2. **Rejected ❌**
   - Google will email you with reasons
   - Common issues for running apps:
     - Background location justification unclear
     - Privacy policy issues
     - Missing data safety declarations
   - Fix issues and resubmit

### Common Rejection Reasons & Fixes

**"Background location not justified":**
- Response: Background location is essential for tracking runs while the user's phone is in their pocket or the app is minimized. Without it, run tracking would stop when the screen turns off.

**"Privacy policy doesn't address location data":**
- Check Phase 2 privacy policy template - it covers this
- Ensure the URL is accessible

**"Data safety form incomplete":**
- Double-check all fields in Step 7 above

### After Approval

**Monitor your app:**
- Play Console → Statistics (installs, crashes)
- Play Console → Ratings & Reviews
- Respond to user reviews promptly

**Set up crash reporting (recommended):**
- Consider adding Sentry or Firebase Crashlytics
- Helps you catch issues quickly

---

## Quick Reference: Command Cheatsheet

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for testing (APK)
eas build --platform android --profile preview

# Build for production (AAB)
eas build --platform android --profile production

# Check build status
eas build:list

# Manage credentials
eas credentials

# View recent builds
eas build:list --limit 5
```

---

## Timeline Estimate

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Security fixes, config updates | 1-2 hours |
| 2 | Privacy policy creation | 30-60 min |
| 3 | EAS setup | 15-30 min |
| 4 | Preview build | 20 min (build time) |
| 5 | Testing on device | 2-4 hours |
| 6 | Create store assets | 2-4 hours |
| 7 | Production build | 20 min (build time) |
| 8 | Play Store submission | 1-2 hours |
| 9 | Google review | 3-7 days (wait) |

**Total active work:** 7-14 hours
**Total calendar time:** 4-8 days (including review)

---

## Files to Create/Update

### Create:
- ✅ `app.config.js` - Replace app.json with dynamic config
- ✅ GitHub repo with `index.html` - Privacy policy
- ✅ Feature graphic (1024x500) - For Play Store
- ✅ Screenshots (2-8 images) - For Play Store

### Update:
- ✅ Install `dotenv` package
- ✅ Delete `app.json` after creating app.config.js

### Verify:
- ✅ `.env.local` has all credentials
- ✅ `.gitignore` includes `.env` files
- ✅ `./assets/icon.png` is 1024x1024
- ✅ `./assets/adaptive-icon.png` exists

---

## Troubleshooting

### Build Fails
```bash
# View build logs
eas build:list
# Click on failed build to see logs
```

Common fixes:
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `eas build --clear-cache`

### API Key Not Working in Build
- Ensure `.env.local` is in project root
- Verify `dotenv/config` is imported in app.config.js
- Check EAS secrets if using: `eas secret:list`

### App Crashes on Device
- Check for missing permissions in app.config.js
- View logs: `adb logcat` (if phone connected to computer)
- Test on emulator first if possible

---

## Support Resources

- **EAS Documentation:** https://docs.expo.dev/build/introduction/
- **Google Play Console:** https://play.google.com/console
- **EAS Dashboard:** https://expo.dev/accounts/castbart/projects/runroute
- **Expo Forums:** https://forums.expo.dev/
- **Play Console Help:** https://support.google.com/googleplay/android-developer

---

## Next Steps After Launch

1. **Monitor Performance**
   - Check crash reports daily
   - Respond to user reviews
   - Monitor Play Console statistics

2. **Future Updates**
   - Increment version in app.config.js
   - Build new production .aab
   - Upload to Play Console → Production → New Release

3. **Marketing**
   - Share Play Store link on social media
   - Ask friends/family to install and review
   - Consider creating a landing page

---

**End of Deployment Guide**

Good luck with your launch! 🚀
