# Google Maps API Key Setup for RunRoute

## Quick Start Checklist

Complete these steps in order:

- [ ] **Step 1**: Run `eas credentials -p android` in your terminal to get SHA-1 fingerprint
- [ ] **Step 2**: Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- [ ] **Step 3**: Edit your API key `********************`
- [ ] **Step 4**: Set Application restrictions to "Android apps"
- [ ] **Step 5**: Add Entry 1: Package `host.exp.exponent` + SHA-1 `*************`
- [ ] **Step 6**: Add Entry 2: Package `com.runroute.app` + SHA-1 from Step 1
- [ ] **Step 7**: Set API restrictions: Maps SDK for Android, Directions API, Places API
- [ ] **Step 8**: Save and wait 5 minutes
- [ ] **Step 9**: Test in Expo Go (`expo start`)
- [ ] **Step 10**: Test in preview build

---

## Overview
This guide will help you configure your Google Maps API key to work across all environments:
- ✅ Expo Go (local development)
- ✅ Preview builds (testing)
- ✅ Production builds (Play Store)

## Step 1: Get SHA-1 Fingerprints from EAS Builds

The SHA-1 fingerprint is **only visible on the Expo web dashboard**, not in the CLI output.

### Get Your Most Recent Build ID

```bash
eas build:list --platform android --limit 1
```

From your output, your most recent preview build ID is:
```
fc997076-a1b4-409c-b311-ca442d239a47
```

### View Build Details on Web Dashboard

**Click this link to see your SHA-1:**
https://expo.dev/accounts/castbart/projects/runroute/builds/fc997076-a1b4-409c-b311-ca442d239a47

**On that page:**
1. Scroll down to the **"Credentials"** section
2. Look for **"Android Keystore SHA-1 Fingerprint"**
3. Copy the value (format: `AB:CD:EF:12:34:56:...`)

### What to Collect:
- **Preview Build SHA-1**: From build `fc997076-a1b4-409c-b311-ca442d239a47`
- **Production Build SHA-1**: Same as preview (EAS uses same keystore by default)

**Note:** The "Fingerprint" field in the CLI output (`da1b115a4d054a5ca4c81cd0d1549bf142e4de17`) is NOT the SHA-1 - that's the EAS update fingerprint.

---

## Step 2: Configure API Key in Google Cloud Console

### 2.1: Navigate to API Key Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with your Maps API)
3. Go to **APIs & Services** → **Credentials**
4. Find your API key: `********************`
5. Click the **Edit** icon (pencil) next to it

### 2.2: Get SHA-1 Fingerprint (Required)

Since Google requires the SHA-1 field, you need to get it from EAS credentials.

**IMPORTANT: You must run this command yourself in your terminal - it requires interactive input:**

```bash
eas credentials -p android
```

**Follow these prompts when you run the command:**

1. **Question**: "Which build profile do you want to configure?"
   - **Answer**: Select `preview` (or `production` - they both use the same keystore)

2. **Question**: "What do you want to do?"
   - **Answer**: Choose `View Android keystore`

3. **Look for this in the output:**
   ```
   SHA-1 Fingerprint: AB:CD:EF:12:34:56:78:...
   ```
   Copy the entire value (format: `AB:CD:EF:12:34:...`)

**Important:** All your EAS builds (preview and production) use the **same keystore** by default, so they all have the **same SHA-1 fingerprint**. You only need to get it once!

**What this SHA-1 is used for:**
- This fingerprint identifies your app's signing certificate
- Google uses it to verify that API requests come from your legitimate app
- Same fingerprint = same keystore = all your builds (preview + production) work with one entry

### 2.3: Set Application Restrictions

Under **Application restrictions**:

1. Select **"Android apps"**

2. Click **"Add an item"** for each entry:

   **Entry 1 - Expo Go (for development):**
   - Package name: `host.exp.exponent`
   - SHA-1 certificate fingerprint: `*************` (Expo's default)

   > **Note:** This is Expo Go's standard SHA-1. It's public and safe to use.

   **Entry 2 - Your App (All EAS builds):**
   - Package name: `com.runroute.app`
   - SHA-1 certificate fingerprint: **[Paste the SHA-1 you got from `eas credentials` command]**

   > **Important:** This ONE SHA-1 works for ALL your builds (preview, production, etc.) because EAS uses the same keystore for all profiles by default.

### 2.3: Set API Restrictions

Under **API restrictions**:

1. Select **"Restrict key"**
2. Check these APIs:
   - ✅ **Maps SDK for Android**
   - ✅ **Directions API**
   - ✅ **Places API** (if using place autocomplete)
   - ✅ **Geocoding API** (if using address lookup)

### 2.4: Save Changes

Click **"Save"** at the bottom.

---

## Step 3: Verify API Key Works

### 3.1: Test with cURL

Replace `<SHA1>` with one of your actual SHA-1 fingerprints and test:

```bash
curl "https://maps.googleapis.com/maps/api/directions/json?origin=51.5074,-0.1278&destination=51.5155,-0.1415&mode=walking&key=********************"
```

**Expected response if working:**
```json
{
  "status": "OK",
  "routes": [...]
}
```

**If it fails:**
```json
{
  "status": "REQUEST_DENIED",
  "error_message": "This API key is not authorized to use this service or API."
}
```

> **Note:** cURL test might fail even if config is correct because it doesn't send package name/SHA-1. The real test is on device.

### 3.2: Test in Expo Go

```bash
expo start
# Scan QR code with Expo Go app
# Try generating a route
```

If you get an error, check the Metro bundler console for detailed error messages.

### 3.3: Test in Preview Build

```bash
# If you made changes, rebuild:
eas build --platform android --profile preview --clear-cache

# Download and install the APK
# Try generating a route
```

---

## Step 4: Understanding Package Names & SHA-1

### Why Multiple Entries?

**Package Name: `host.exp.exponent`**
- This is Expo Go's package name
- Required for `expo start` + Expo Go testing
- No SHA-1 needed (Expo manages this)

**Package Name: `com.runroute.app`**
- Your app's package name (from app.config.js)
- Required for preview and production builds
- Each build has a SHA-1 fingerprint from EAS's keystore

### Why Same SHA-1 for Preview and Production?

EAS uses the same keystore for all profiles by default, so the SHA-1 will be identical. You only need to add it once unless you use different keystores.

---

## Step 5: Alternative - Separate Keys (Optional)

If you want better security, use two separate API keys:

### Development Key (`AIzaXXXXDEV`)
- **Application restrictions:** Android apps
  - Package: `host.exp.exponent`
- **API restrictions:** All Maps APIs enabled
- **Quota:** Can set lower limits (for cost control)
- **Usage:** Only in `.env.local` and `eas.json` development profile

### Production Key (`AIzaXXXXPROD`)
- **Application restrictions:** Android apps
  - Package: `com.runroute.app` + SHA-1
- **API restrictions:** Only required APIs
- **Quota:** Set to expected production usage
- **Usage:** Only in `eas.json` preview and production profiles

**Update eas.json:**
```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaXXXXDEV"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaXXXXPROD"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaXXXXPROD"
      }
    }
  }
}
```

---

## Troubleshooting

### Error: "REQUEST_DENIED"

**Cause:** API key restrictions are blocking the request

**Solutions:**
1. Double-check package name is exactly `com.runroute.app`
2. Verify SHA-1 fingerprint matches your build
3. Wait 5 minutes after saving changes (propagation delay)
4. Temporarily remove all restrictions to isolate issue

### Error: "This API project is not authorized to use this API"

**Cause:** Directions API not enabled

**Solution:**
1. Go to **APIs & Services** → **Library**
2. Search for "Directions API"
3. Click **Enable**

### Error: "OVER_QUERY_LIMIT"

**Cause:** Billing not enabled or quota exceeded

**Solution:**
1. Go to **Billing** in Google Cloud Console
2. Link a billing account
3. Verify billing is active

### Works in Expo Go but not Preview Build

**Cause:** SHA-1 mismatch or missing entry

**Solution:**
1. Run `eas build:view <build-id>` for your preview build
2. Copy the exact SHA-1 fingerprint
3. Add it to Google Cloud Console
4. Wait 5 minutes and test again

---

## Current Configuration (Recommended)

Based on your setup, here's what I recommend:

### Single API Key Setup (Simplest)

**Key:** `********************`

**Restrictions:**
```
Application restrictions: Android apps
  ├─ host.exp.exponent (no SHA-1)
  ├─ com.runroute.app + <preview SHA-1>
  └─ com.runroute.app + <production SHA-1> (if different)

API restrictions:
  ├─ Maps SDK for Android
  ├─ Directions API
  └─ Places API (if needed)
```

This allows:
- ✅ Local development with Expo Go
- ✅ Preview builds for testing
- ✅ Production builds for Play Store
- ✅ Protects against unauthorized usage
- ✅ Limits to only required APIs

---

## Quick Reference Commands

```bash
# Get SHA-1 fingerprint (INTERACTIVE - run this yourself)
eas credentials -p android
# Select: preview → View Android keystore → Copy SHA-1

# Rebuild preview with current env vars
eas build --platform android --profile preview --clear-cache

# Test locally
expo start

# Check what package name is in your app
grep -r "package" app.config.js
```

---

## Next Steps

1. ✅ Run `eas build:list` to get your SHA-1 fingerprints
2. ✅ Go to Google Cloud Console and configure restrictions
3. ✅ Wait 5 minutes for changes to propagate
4. ✅ Test in Expo Go
5. ✅ Test in preview build
6. ✅ Update [deploymentguide.md](deploymentguide.md) with these steps

---

**Last Updated:** 2025-11-26
**Your API Key:** `********************`
**Your Package:** `com.runroute.app`
**Expo Go Package:** `host.exp.exponent`
