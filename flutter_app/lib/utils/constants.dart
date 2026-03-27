// ============================================
// App Constants
// ============================================
//
// WHAT IS THIS FILE?
// It stores values that are used throughout the app but never change.
// Instead of typing "R10.00" everywhere, we write it once here and
// reference it. If we ever need to change the booking fee to R15,
// we only change it in ONE place.
//
// WHY IS THIS IMPORTANT?
// Imagine you hard-coded "R10.00" in 50 different places. Now you
// want to change it to R15. You'd have to find and change all 50.
// With constants, you change it once here. Done.
// ============================================

import 'package:flutter/material.dart';

class AppConstants {
  // ============================================
  // SUPABASE CONNECTION
  // ============================================
  // You get these from your Supabase dashboard:
  // 1. Go to app.supabase.com
  // 2. Open your project
  // 3. Click "Settings" → "API"
  // 4. Copy the URL and anon key
  //
  // IMPORTANT: The anon key is safe to put in your app code.
  // It only allows access that your RLS policies permit.
  // The SERVICE ROLE key must NEVER be in app code.

  static const String supabaseUrl = 'YOUR_SUPABASE_URL_HERE';
  // Example: 'https://abcdefghijklm.supabase.co'

  static const String supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY_HERE';
  // Example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

  // ============================================
  // GOOGLE MAPS
  // ============================================
  // You need a Google Maps API key to show the map.
  // Get one at: https://console.cloud.google.com
  // Enable "Maps SDK for Android" and "Maps SDK for iOS"

  static const String googleMapsApiKey = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  // ============================================
  // YOCO PAYMENT
  // ============================================
  // Yoco is South Africa's payment processor.
  // The PUBLIC key goes here (safe to put in app code).
  // The SECRET key goes in Supabase Edge Function secrets (NEVER in app code).
  //
  // Get your keys at: yoco.com → Dashboard → Developers → API Keys
  // Use sk_test_ keys during development, sk_live_ for production.

  static const String yocoPublicKey = 'YOUR_YOCO_PUBLIC_KEY_HERE';
  // Example: 'pk_test_abc123def456'

  // ============================================
  // APP COLORS
  // ============================================
  // These define VouchSA's look and feel.
  // The hex codes (0xFF...) are color values.
  // You can change these to match your brand.

  static const Color primaryColor = Color(0xFF1B5E20);    // Deep green (trust, growth)
  static const Color secondaryColor = Color(0xFFFFC107);  // Amber/gold (warmth, SA sunshine)
  static const Color accentColor = Color(0xFF2196F3);     // Blue (reliability)

  // Service category colors (for map pins)
  static const Color beautyColor = Color(0xFFE53935);     // Red for beauty services
  static const Color gardenColor = Color(0xFF43A047);     // Green for gardening
  static const Color cleaningColor = Color(0xFF1E88E5);   // Blue for cleaning
  static const Color handymanColor = Color(0xFFFF9800);   // Orange for handyman

  // ============================================
  // BUSINESS RULES
  // ============================================
  static const double bookingFee = 10.00;           // R10 flat fee per booking
  static const double commissionRate = 10.0;        // 10% commission
  static const double minPayoutAmount = 100.00;     // Minimum R100 to request payout
  static const int locationUpdateSeconds = 30;      // GPS update frequency
  static const int bookingAcceptTimeoutMinutes = 2; // Pro has 2 min to accept instant booking
  static const int chatExpiryHours = 48;            // Chat auto-deletes 48hrs after job

  // ============================================
  // SERVICE CATEGORIES
  // ============================================
  // The types of services available on VouchSA.
  // Each has an icon and a color for the map pin.

  static const Map<String, Map<String, dynamic>> serviceCategories = {
    'barber': {
      'label': 'Barber',
      'icon': Icons.content_cut,
      'color': beautyColor,
    },
    'nail_tech': {
      'label': 'Nail Tech',
      'icon': Icons.brush,
      'color': beautyColor,
    },
    'gardener': {
      'label': 'Gardener',
      'icon': Icons.grass,
      'color': gardenColor,
    },
    'cleaner': {
      'label': 'Cleaner',
      'icon': Icons.cleaning_services,
      'color': cleaningColor,
    },
    'handyman': {
      'label': 'Handyman',
      'icon': Icons.build,
      'color': handymanColor,
    },
    'painter': {
      'label': 'Painter',
      'icon': Icons.format_paint,
      'color': handymanColor,
    },
    'plumber': {
      'label': 'Plumber',
      'icon': Icons.plumbing,
      'color': handymanColor,
    },
    'electrician': {
      'label': 'Electrician',
      'icon': Icons.electric_bolt,
      'color': handymanColor,
    },
  };

  // ============================================
  // TRUST BADGES
  // ============================================
  // The levels of trust a pro can achieve.

  static const Map<String, Map<String, dynamic>> trustBadges = {
    'new': {
      'label': 'New Pro',
      'color': Color(0xFF4CAF50),   // Green
      'minVouches': 0,
      'minRate': 0.0,
    },
    'trusted': {
      'label': 'Trusted',
      'color': Color(0xFF2196F3),   // Blue
      'minVouches': 10,
      'minRate': 85.0,
    },
    'certified': {
      'label': 'Certified Pro',
      'color': Color(0xFFFFC107),   // Gold
      'minVouches': 25,
      'minRate': 90.0,
    },
  };
}
