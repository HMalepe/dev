# VouchSA - Getting Started Guide (For Absolute Beginners)

This guide assumes you've never written code before. Every step is explained.

---

## What You'll Need

Before we start, you need a few things installed on your computer:

### 1. A Computer
- Windows 10+, macOS, or Linux
- At least 8GB RAM (16GB is better)
- At least 20GB free disk space

### 2. An Android Phone (for testing)
- OR an iPhone (but Android is easier to test with)
- You can also use an emulator (a fake phone on your computer)

---

## Step 1: Create Your Supabase Project (The Database)

**What is Supabase?**
It's where all your app's data lives — users, bookings, vouches, everything.
Think of it as a giant spreadsheet in the cloud that your app reads and writes to.

**How to set it up:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "Sign Up" (use your Google or GitHub account)
3. Click "New Project"
4. Fill in:
   - **Name:** VouchSA
   - **Database Password:** Choose something strong (save it somewhere!)
   - **Region:** Choose "South Africa" or the closest option
5. Click "Create new project"
6. Wait 2-3 minutes for it to set up

**After it's ready:**

7. Click "Settings" in the left sidebar
8. Click "API"
9. You'll see two important values:
   - **Project URL:** Something like `https://abcdef.supabase.co`
   - **anon/public key:** A long string starting with `eyJ...`
10. **Copy both of these** — you'll need them later

**Now create the database tables:**

11. Click "SQL Editor" in the left sidebar
12. Click "New query"
13. Open the file `supabase/migrations/001_initial_schema.sql` from this project
14. Copy ALL the contents and paste into the SQL editor
15. Click "Run" (the green play button)
16. You should see "Success" at the bottom
17. Repeat with `supabase/migrations/002_functions.sql`

**Enable Phone Auth (for OTP login):**

18. Click "Authentication" in the left sidebar
19. Click "Providers"
20. Find "Phone" and toggle it ON
21. Follow Supabase's guide to configure an SMS provider for OTP

**Create Storage Buckets (for photos/videos):**

22. Click "Storage" in the left sidebar
23. Click "New bucket" and create these:
    - `profile-photos` (toggle "Public" ON)
    - `voice-intros` (toggle "Public" ON)
    - `video-intros` (toggle "Public" ON)
    - `portfolio-images` (toggle "Public" ON)

---

## Step 2: Install Flutter (The App Framework)

**What is Flutter?**
It's a toolkit from Google that lets you build apps for Android AND iPhone
from one set of code. Instead of building two separate apps, you build one.

**Install Flutter:**

### On macOS:
```bash
# Open Terminal (search "Terminal" in Spotlight)
# Install Homebrew first (a package manager for Mac):
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Flutter:
brew install flutter

# Verify it worked:
flutter doctor
```

### On Windows:
1. Go to [flutter.dev/docs/get-started/install/windows](https://flutter.dev/docs/get-started/install/windows)
2. Download the Flutter SDK zip file
3. Extract it to `C:\flutter`
4. Add `C:\flutter\bin` to your system PATH:
   - Search "Environment Variables" in Windows Settings
   - Under "System variables", find "Path"
   - Click "Edit" → "New" → type `C:\flutter\bin`
5. Open Command Prompt and run: `flutter doctor`

### On Linux:
```bash
sudo snap install flutter --classic
flutter doctor
```

**`flutter doctor` will tell you what else you need.** Follow its instructions.
Common things it asks for:
- **Android Studio** (needed for Android emulator)
- **Xcode** (needed for iPhone, Mac only)
- **Chrome** (for web testing)

---

## Step 3: Install an IDE (Code Editor)

**What is an IDE?**
It's a special text editor designed for writing code. It highlights syntax,
catches errors, and has tools that make coding easier.

**Recommended: VS Code (free)**

1. Download from [code.visualstudio.com](https://code.visualstudio.com)
2. Install it
3. Open VS Code
4. Install these extensions (click the puzzle piece icon in the left sidebar):
   - **Flutter** (by Dart Code) — THE most important one
   - **Dart** (by Dart Code) — language support

**Alternative: Cursor AI ($20/month)**
- Same as VS Code but with AI built in
- You can type instructions in plain English
- It writes code for you
- Great for beginners — highly recommended if you can afford it

---

## Step 4: Get a Google Maps API Key

**Why?**
The map in your app needs permission from Google to show.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project called "VouchSA"
3. Enable these APIs (search for them):
   - "Maps SDK for Android"
   - "Maps SDK for iOS"
   - "Geocoding API" (converts addresses to coordinates)
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key

**Cost:** Google gives you $200/month free. That's ~28,000 map loads.
More than enough for development and early launch.

---

## Step 4b: Set Up Firebase (Push Notifications)

**Why?**
Firebase Cloud Messaging (FCM) sends push notifications to users even
when the app is closed — like "Your booking was accepted!"

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project" → Name it "VouchSA"
3. Disable Google Analytics (not needed for notifications)
4. Click "Create project"

**Add your Android app:**

5. Click the Android icon on the project overview page
6. Enter package name: `com.vouchsa.app`
7. Click "Register app"
8. Download `google-services.json`
9. Place it in: `flutter_app/android/app/google-services.json`
10. Skip the "Add Firebase SDK" steps (already in pubspec.yaml)

**Get your server key (for Edge Functions):**

11. In Firebase Console → Project Settings → "Service accounts"
12. Click "Generate new private key"
13. Save the downloaded JSON file
14. Add it as a Supabase secret:
    ```
    supabase secrets set FIREBASE_SERVICE_ACCOUNT_KEY='<paste entire JSON file contents>'
    ```

**Also run this SQL migration:**

15. In Supabase SQL Editor, paste and run `supabase/migrations/003_device_tokens.sql`

**Cost:** Free. FCM has no usage limits for push notifications.

---

## Step 5: Set Up the Flutter Project (Connect Everything)

Now let's connect everything:

```bash
# Open Terminal/Command Prompt

# Navigate to where you downloaded this project
cd path/to/vouchsa/flutter_app

# Install all the packages listed in pubspec.yaml
flutter pub get

# This downloads all the tools your app needs (maps, auth, etc.)
```

**Connect to Supabase:**

Open `lib/utils/constants.dart` and replace the placeholder values:

```dart
static const String supabaseUrl = 'https://YOUR-PROJECT.supabase.co';
static const String supabaseAnonKey = 'eyJ...YOUR-KEY-HERE';
static const String googleMapsApiKey = 'AIza...YOUR-KEY-HERE';
```

**Add Google Maps API Key to Android:**

Open `android/app/src/main/AndroidManifest.xml` and add inside `<application>`:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

---

## Step 6: Run the App!

```bash
# Connect your Android phone via USB
# OR start an emulator from Android Studio

# Run the app:
flutter run

# The first build takes 2-5 minutes. After that, it's much faster.
```

**What you should see:**
1. The VouchSA login screen with a phone number input
2. You won't be able to log in yet until Twilio is set up

**For testing without Twilio:**
In your Supabase dashboard, go to Authentication → Users → "Add User"
to manually create test accounts.

---

## Step 7: What to Build Next

Now that everything is set up, here's the order to build features:

### Authentication (Login flow) - DONE
- ✅ Phone number input screen
- ✅ OTP verification screen
- ✅ Profile setup screen (client/pro/both selection)
- ✅ Auth Edge Function (Supabase + Twilio OTP)
- [x] Profile photo upload (camera/gallery picker)
- [ ] Pro service setup wizard (pick categories, set prices)

### The Map - DONE
- ✅ Google Maps with real-time pro pins
- ✅ Color-coded pins by service category
- ✅ Category filter chips
- ✅ Tap pin to see pro preview card
- ✅ Pro availability toggle (Go Live / Go Offline)
- ✅ GPS location tracking every 30 seconds
- ✅ Real-time Supabase subscription for pin updates
- ✅ Search bar filtering by category

### Booking - DONE
- ✅ "Book Now" instant booking flow (4-step stepper)
- ✅ "Schedule Booking" advance booking flow
- ✅ In-app notifications screen
- ✅ Job lifecycle (pending → accepted → in_progress → completed)
- ✅ Active booking screen with real-time status updates
- ✅ In-app chat (text messaging, real-time)

### Trust & Payment - DONE
- ✅ Vouch system (post-job prompt with optional comment)
- ✅ Trust badges (New Pro → Trusted → Certified, auto-upgraded)
- ✅ Yoco payment integration (checkout, verification, webhooks)
- ✅ Escrow flow (authorize → capture → payout)
- ✅ Pro earnings dashboard with payout requests
- ✅ "My Pros" favorites screen

### Profile & Settings - DONE
- ✅ User profile/settings screen (edit name, bio, emergency contact)
- ✅ Pro settings (hourly rate, service radius slider, bank details)
- ✅ Logout flow

### Still Needed (Your Next Steps)
- [x] Profile photo upload (camera/gallery → Supabase Storage)
- [ ] Voice/video intro recording and playback
- [x] Push notifications via Firebase Cloud Messaging (code built, needs Firebase project setup)
- [ ] Automated payout processing (currently manual via Yoco dashboard)
- [ ] App icon and splash screen
- [ ] Testing on real Android device
- [ ] Google Play Store submission

---

## How to Use Claude Code to Help You Build

You're already using it! Here are tips for getting the most out of it:

### Good prompts:
- "Create the Google Maps widget for the map screen that shows pro location pins"
- "Build the booking flow screen where a client selects a service and confirms"
- "Write the Supabase query to find all available pros within 10km of my location"
- "I'm getting this error: [paste error]. How do I fix it?"

### Bad prompts:
- "Build VouchSA" (too vague)
- "Make it work" (need specifics)
- "Do everything" (break it into pieces)

### The key principle:
**Build ONE small thing at a time. Test it. Then move to the next thing.**

Don't try to build the entire app at once. That's how projects fail.

---

## Common Problems & Solutions

### "flutter doctor shows issues"
Run `flutter doctor -v` for detailed info. It usually needs:
- Android Studio (even if you use VS Code)
- Android SDK licenses: run `flutter doctor --android-licenses`

### "Build failed"
- Run `flutter clean` then `flutter pub get` then `flutter run`
- Check the error message — it usually says what's wrong

### "Supabase connection failed"
- Double-check your URL and anon key in constants.dart
- Make sure your Supabase project is running (green status)
- Check that RLS policies were created (run the SQL file again)

### "Map shows blank/grey"
- Check your Google Maps API key
- Make sure you enabled "Maps SDK for Android" in Google Cloud Console
- Check the AndroidManifest.xml has the key

---

## Monthly Costs Estimate

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Supabase | 50,000 MAU, 500MB storage | R350/month |
| Google Maps | $200/month credit (28K loads) | Pay per load |
| Firebase (notifications) | Free for push | Free |
| Google Play Store | Once-off R400 | - |
| Apple App Store | R1,600/year | R1,600/year |

**Total to get started: R0-R400** (if you skip Apple initially)
**Monthly after launch: ~R500-R1,000** (depending on users)
