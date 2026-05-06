# VouchSA - Cursor AI Handoff Document

## WHAT IS THIS PROJECT?

VouchSA is a trust-based marketplace mobile app for South African suburbs. It connects clients with local service professionals (barbers, cleaners, gardeners, plumbers, etc.). Think of it as "Uber for home services" but built on community trust — instead of star ratings, people "vouch" for pros they've used and trust.

**Tech Stack:** Flutter (Dart) + Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) + Google Maps + Yoco Payments + Firebase Cloud Messaging

**GitHub Repo:** HMalepe/dev
**Branch:** claude/vouchsa-planning-5uJvC
**Owner:** An absolute beginner to coding — explain things simply.

---

## PROJECT STRUCTURE

```
/home/user/dev/
├── .env.example                          # Template for API keys
├── .gitignore
├── flutter_app/                          # The mobile app
│   ├── pubspec.yaml                      # Dependencies (packages)
│   └── lib/
│       ├── main.dart                     # App entry point
│       ├── models/
│       │   ├── user_model.dart           # ProfileModel, UserModel
│       │   └── booking_model.dart        # BookingModel, ProServiceModel, VouchModel
│       ├── providers/
│       │   ├── auth_provider.dart        # Login/logout state
│       │   ├── location_provider.dart    # GPS tracking
│       │   └── map_provider.dart         # Map pins, filters, nearby pros
│       ├── screens/
│       │   ├── splash/splash_screen.dart          # Animated launch screen
│       │   ├── auth/login_screen.dart             # Phone OTP login
│       │   ├── auth/profile_setup_screen.dart      # New user profile creation
│       │   ├── map/map_screen.dart                 # Main map with pro pins (HOME SCREEN)
│       │   ├── profile/pro_profile_screen.dart     # Full pro profile view
│       │   ├── profile/settings_screen.dart        # User settings & preferences
│       │   ├── booking/booking_flow_screen.dart    # Book a pro (instant or scheduled)
│       │   ├── booking/active_booking_screen.dart  # Live booking status with realtime updates
│       │   ├── booking/bookings_list_screen.dart   # All bookings history
│       │   ├── booking/vouch_screen.dart           # Post-job vouch/endorsement
│       │   ├── chat/conversations_screen.dart      # Chat list
│       │   ├── chat/chat_screen.dart               # Real-time messaging (in-app only)
│       │   ├── payment/payment_checkout_screen.dart # Yoco webview payment
│       │   ├── payment/pro_earnings_screen.dart    # Pro earnings dashboard
│       │   ├── notifications/notifications_screen.dart # Push notification list
│       │   ├── favorites/my_pros_screen.dart       # Saved/favorited pros
│       │   ├── pro_setup/pro_setup_wizard.dart     # 3-step pro onboarding
│       │   ├── pro_setup/manage_services_screen.dart # CRUD for pro services
│       │   ├── pro_setup/record_intro_screen.dart  # 30-sec voice intro recorder
│       │   └── pro_setup/portfolio_screen.dart     # Work photo gallery
│       ├── services/
│       │   ├── pro_service.dart           # Pro discovery, availability toggle
│       │   ├── booking_service.dart        # Booking lifecycle (create → complete)
│       │   ├── chat_service.dart           # Real-time messaging
│       │   ├── payment_service.dart        # Yoco payment processing
│       │   ├── photo_service.dart          # Camera/gallery → Supabase Storage
│       │   └── notification_service.dart   # FCM push notifications
│       ├── utils/
│       │   └── constants.dart             # App-wide constants (colors, fees, API URLs)
│       └── widgets/
│           ├── pro_preview_card.dart       # Map popup card for pros
│           └── trust_badge.dart            # Bronze/Silver/Gold/Platinum badge
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql         # All tables, RLS policies, triggers
│   │   ├── 002_functions.sql              # PostGIS functions (find_nearby_pros)
│   │   └── 003_device_tokens.sql          # FCM token storage
│   └── functions/
│       ├── auth/index.ts                  # Phone OTP auth (send, verify, register)
│       ├── pros/index.ts                  # Pro discovery, availability, services
│       ├── bookings/index.ts              # Booking lifecycle + auto payment capture
│       ├── payments/index.ts              # Yoco checkout, escrow, capture, payouts
│       ├── vouches/index.ts               # Trust/vouch system
│       └── notifications/index.ts         # Send FCM push notifications
└── docs/
    ├── MVP_ROADMAP.md                     # Feature roadmap with completion status
    └── GETTING_STARTED.md                 # Setup guide for beginners
```

---

## WHAT IS ALREADY BUILT (100% coded)

### Frontend (Flutter) - 20 Screens
- Animated splash screen with VouchSA branding
- Phone OTP login (via Supabase Auth)
- Profile creation with photo upload
- Google Maps home screen with real-time pro location pins
- Pro profile view with voice intro playback, portfolio gallery, vouches, services
- Booking flow (instant + scheduled) with address, notes, cost breakdown
- Active booking screen with real-time status updates (Supabase Realtime)
- Chat (real-time, in-app only — NO Twilio, NO WhatsApp, NO SMS)
- Yoco payment checkout (webview-based)
- Pro earnings dashboard
- Push notification list with mark-as-read
- Favorites/saved pros list
- Settings screen (edit profile, photo, pro settings, bank details)
- Pro setup wizard (3-step: categories → rates → services)
- Manage services CRUD
- Voice intro recorder (30-sec max, m4a format)
- Portfolio photo gallery with captions
- Report issue flow (from active booking)
- Share pro profile (native share sheet)
- Vouch/endorsement screen (post-job)

### Backend (Supabase Edge Functions) - 6 Functions
- **auth**: Phone OTP send/verify, user registration
- **pros**: Discovery (nearby search via PostGIS), availability toggle, service listing
- **bookings**: Full lifecycle (create → accept → start → complete → dispute), auto-triggers payment capture on completion
- **payments**: Yoco checkout URL generation, escrow hold, capture_and_payout (auto calculates 90% pro / 10% commission), Yoco Transfer API for payouts with manual fallback
- **vouches**: Create vouch, get vouches for a pro, vouch stats
- **notifications**: Send FCM push via Firebase HTTP v1 API, auto-clean expired tokens

### Database (PostgreSQL via Supabase) - 3 Migration Files
Tables: profiles, pro_profiles, pro_services, bookings, conversations, messages, vouches, favorites, notifications, reports, payment_transactions, device_tokens
- PostGIS enabled for geographic queries
- Row Level Security (RLS) on all tables
- Database triggers for auto-updating vouch counts and certification levels
- Function: find_nearby_available_pros(lat, lng, radius_km)

### State Management - 3 Providers
- AuthProvider (login state, current user)
- LocationProvider (GPS position, permissions)
- MapProvider (pro pins, category filters, search)

---

## WHAT IS NOT YET DONE (Setup & Config — No New Code Needed)

### 1. External Service Setup (owner must do)
- [ ] Create Supabase project at app.supabase.com
- [ ] Enable PostGIS extension in Supabase SQL editor: `CREATE EXTENSION IF NOT EXISTS postgis;`
- [ ] Run the 3 migration SQL files in order (001, 002, 003)
- [ ] Create Supabase Storage buckets: `profile-photos`, `portfolio-images`, `voice-intros` (all public)
- [ ] Deploy Edge Functions: `supabase functions deploy auth && supabase functions deploy pros && supabase functions deploy bookings && supabase functions deploy payments && supabase functions deploy vouches && supabase functions deploy notifications`
- [ ] Get Google Maps API key from console.cloud.google.com (enable Maps SDK for Android + iOS)
- [ ] Create Firebase project, add Android/iOS app, download google-services.json → android/app/ and GoogleService-Info.plist → ios/Runner/
- [ ] Set up Yoco merchant account at yoco.com (get test keys first)
- [ ] Create `.env` file from `.env.example` with real keys
- [ ] Add Google Maps API key to AndroidManifest.xml and iOS AppDelegate

### 2. Asset Files Needed
- [ ] Create `flutter_app/assets/images/` directory
- [ ] Create `flutter_app/assets/icons/` directory
- [ ] Add app icon (can use flutter_launcher_icons package)
- [ ] Add a VouchSA logo image (optional — currently uses Material icon)

### 3. Testing & Polish
- [ ] Run `cd flutter_app && flutter pub get` to install packages
- [ ] Run `flutter run` on a real device or emulator
- [ ] Test the full flow: sign up → set up profile → browse map → book a pro → chat → pay → vouch
- [ ] Fix any runtime bugs found during testing
- [ ] Test push notifications (requires real device, not emulator)
- [ ] Test Yoco payment with test keys

### 4. App Store Publishing
- [ ] Android: Register on Google Play Console ($25 one-time), create app listing, upload APK/AAB
- [ ] iOS: Register for Apple Developer Program ($99/year), requires a Mac to build, submit for review
- [ ] Build release APK: `flutter build apk --release`
- [ ] Build release iOS: `flutter build ios --release` (Mac only)

---

## KEY DESIGN DECISIONS (DO NOT CHANGE)

1. **In-app messaging ONLY** — No Twilio, no SMS, no WhatsApp. All chat is via Supabase Realtime.
2. **Phone OTP auth** — Users log in with their South African phone number via Supabase built-in auth.
3. **Vouch system, not star ratings** — Pros earn trust through vouches (endorsements), not 1-5 stars. Certification levels: Starter (0), Bronze (3+), Silver (10+), Gold (25+), Platinum (50+).
4. **Yoco for payments** — South African payment processor. Escrow flow: client pays → held → released to pro on completion (90% pro, 10% commission).
5. **Provider for state management** — Simple and beginner-friendly. Not Bloc, not Riverpod.
6. **Conversations expire 48 hours after job completion** — Prevents ongoing contact outside the platform.

---

## DATABASE SCHEMA (Key Tables)

```sql
profiles          — user_id, display_name, phone, bio, profile_photo_url, voice_intro_url, is_pro
pro_profiles      — user_id, service_categories[], hourly_rate, service_radius_km, is_available, vouch_count, certification_level, bank_details
pro_services      — id, pro_id, service_name, description, duration_minutes, price, is_active
bookings          — id, client_id, pro_id, service_id, status, service_address, lat/lng, scheduled_start, actual_start/end, total_amount, booking_fee, commission_rate
conversations     — id, booking_id, client_id, pro_id, expires_at
messages          — id, conversation_id, sender_id, content, is_read
vouches           — id, voucher_id, vouchee_id, booking_id, vouch_text
favorites         — id, user_id, pro_id
notifications     — id, user_id, type, title, body, is_read, related_booking_id, action_url
payment_transactions — id, booking_id, type (escrow_hold/capture/payout/refund), amount, status, yoco_checkout_id
device_tokens     — id, user_id, fcm_token, platform
reports           — id, reporter_id, reported_user_id, booking_id, report_type, description, status
```

---

## DEPENDENCIES (pubspec.yaml)

```yaml
supabase_flutter: ^2.3.0         # Backend
google_maps_flutter: ^2.5.3      # Maps
geolocator: ^11.0.0              # GPS
image_picker: ^1.0.7             # Camera/gallery
video_player: ^2.8.2             # Intro playback
record: ^5.0.4                   # Voice recording
firebase_core: ^2.25.4           # Firebase base
firebase_messaging: ^14.7.15     # Push notifications
flutter_local_notifications: ^17.0.0
provider: ^6.1.1                 # State management
go_router: ^13.0.0               # Navigation
share_plus: ^7.2.1               # Native sharing
webview_flutter: ^4.5.0          # Yoco payment page
http: ^1.2.0                     # API calls
path_provider: ^2.1.2            # File system access
```

---

## COMMON PATTERNS IN THIS CODEBASE

- **Supabase client access**: `Supabase.instance.client` (imported from supabase_flutter)
- **Current user ID**: `Supabase.instance.client.auth.currentUser!.id`
- **Colors**: Green primary (`Color(0xFF2E7D32)`), defined in `constants.dart`
- **Currency**: South African Rand (R), formatted as `R${amount.toStringAsFixed(2)}`
- **File uploads**: Go through `PhotoService` which handles picking + compression + Supabase Storage upload
- **Real-time**: Supabase Realtime channels for chat messages and booking status updates
- **Error handling**: Try/catch with SnackBar feedback to user
- **Navigation**: `Navigator.of(context).push(MaterialPageRoute(...))` (not go_router throughout — go_router is declared but most screens use direct Navigator)

---

## IF ASKED TO ADD NEW FEATURES

The MVP is complete. Possible post-launch features the owner may request:
- Admin dashboard (web panel for managing disputes, viewing analytics)
- Pro verification (ID document upload + manual review)
- Scheduled availability calendar for pros
- Multi-language support (English, Zulu, Afrikaans, Sotho)
- Referral system
- In-app tips/gratuity
- Service area heat maps
- Group bookings

---

## IMPORTANT NOTES

- The `.env` file is gitignored — never commit API keys
- The Flutter app does NOT have a `flutter_app/` directory created via `flutter create` — the owner needs to run `flutter create .` inside `flutter_app/` first if the android/ios folders don't exist, OR create a new Flutter project and copy the `lib/` folder into it
- All Edge Functions use Deno (TypeScript) — Supabase's runtime
- PostGIS must be enabled in Supabase before running migrations
- The app targets both Android and iOS from the same codebase
- No Twilio, no SMS, no WhatsApp — this was explicitly removed by the owner
