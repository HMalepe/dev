// ============================================
// VouchSA - Main Entry Point
// ============================================
//
// WHAT IS THIS FILE?
// This is where your app STARTS. When someone opens VouchSA on their
// phone, this is the first code that runs. Think of it like the
// front door of a building — everything starts here.
//
// WHAT DOES IT DO?
// 1. Connects to Supabase (your backend/database)
// 2. Sets up the app's theme (colors, fonts)
// 3. Decides which screen to show first (login or home)
// ============================================

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/location_provider.dart';
import 'providers/map_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/map/map_screen.dart';
import 'services/notification_service.dart';
import 'utils/constants.dart';

/// This is the very first function that runs when the app opens.
/// "async" means it does some things that take time (like connecting to Supabase)
/// and waits for them to finish before continuing.
void main() async {
  // Tell Flutter to wait until everything is ready before showing the app
  WidgetsFlutterBinding.ensureInitialized();

  // Connect to Supabase using your project's URL and public key
  // You'll replace these with YOUR values from the Supabase dashboard
  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
  );

  // Initialize push notifications (Firebase Cloud Messaging)
  // This requests permission and saves the device token.
  // If Firebase isn't configured yet, it silently skips.
  try {
    await NotificationService().initialize();
  } catch (_) {
    // Firebase not configured yet — that's fine during development
  }

  // Start the app!
  runApp(const VouchSAApp());
}

/// The root of the entire app.
/// "StatelessWidget" means this widget doesn't change after it's built.
class VouchSAApp extends StatelessWidget {
  const VouchSAApp({super.key});

  @override
  Widget build(BuildContext context) {
    // MultiProvider makes our "providers" available to every screen in the app.
    // Providers are like global variables that any screen can read/update.
    return MultiProvider(
      providers: [
        // Manages login state: is the user logged in? who are they?
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        // Manages GPS location: where is the user right now?
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        // Manages map data: nearby pros, filters, selected pro
        ChangeNotifierProvider(create: (_) => MapProvider()),
      ],
      child: MaterialApp(
        title: 'VouchSA',
        debugShowCheckedModeBanner: false, // Removes the "DEBUG" banner

        // ============================================
        // APP THEME (Colors & Fonts)
        // ============================================
        // This defines how the app looks: colors, button styles, text sizes, etc.
        theme: ThemeData(
          // Primary color: used for buttons, app bar, links
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppConstants.primaryColor,
            primary: AppConstants.primaryColor,
            secondary: AppConstants.secondaryColor,
          ),
          useMaterial3: true, // Use the latest Material Design

          // App bar style (the bar at the top of each screen)
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            elevation: 0,
          ),

          // Button style
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),

          // Input field style (text boxes)
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
        ),

        // ============================================
        // STARTING SCREEN
        // ============================================
        // Check if user is already logged in:
        // - Yes → Show the map screen (home)
        // - No → Show the login screen
        home: Supabase.instance.client.auth.currentSession != null
            ? const MapScreen()
            : const LoginScreen(),
      ),
    );
  }
}
