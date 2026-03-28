// ============================================
// Notification Service - Push Notifications via FCM
// ============================================
//
// Uses Firebase Cloud Messaging (FCM) to send push notifications
// to users even when the app is closed.
//
// HOW PUSH NOTIFICATIONS WORK:
// 1. When the app starts, we ask Firebase for a unique "token"
//    (like a phone number for push notifications)
// 2. We save that token to the database (device_tokens table)
// 3. When something happens (new booking, vouch, etc.),
//    the Edge Function looks up the user's token and sends
//    a push notification via Firebase
// 4. The user's phone shows the notification even if the app is closed
//
// SETUP REQUIRED:
// 1. Create a Firebase project at console.firebase.google.com
// 2. Add your Android app (package name: com.vouchsa.app)
// 3. Download google-services.json → put in android/app/
// 4. For iOS: download GoogleService-Info.plist → put in ios/Runner/
// ============================================

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final SupabaseClient _supabase = Supabase.instance.client;

  bool _initialized = false;

  /// Call this once when the app starts (in main.dart).
  Future<void> initialize() async {
    if (_initialized) return;

    // Initialize Firebase
    await Firebase.initializeApp();

    // Request permission to show notifications
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return; // User denied — don't set up further
    }

    // Set up local notifications (for when app is in foreground)
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // Create a notification channel for Android (required for Android 8+)
    const androidChannel = AndroidNotificationChannel(
      'vouchsa_notifications',
      'VouchSA Notifications',
      description: 'Booking updates, vouches, and more',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // Listen for messages when app is in foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Listen for when user taps a notification (app was in background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app was opened from a notification (app was closed)
    final initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // Get and save the FCM token
    await _saveToken();

    // Listen for token refresh (happens occasionally)
    _fcm.onTokenRefresh.listen((newToken) {
      _saveTokenToDatabase(newToken);
    });

    _initialized = true;
  }

  /// Gets the current FCM token and saves it to the database.
  Future<void> _saveToken() async {
    final token = await _fcm.getToken();
    if (token != null) {
      await _saveTokenToDatabase(token);
    }
  }

  /// Saves the FCM token to the device_tokens table.
  /// Uses upsert so each device only has one token row.
  Future<void> _saveTokenToDatabase(String token) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await _supabase.from('device_tokens').upsert(
        {
          'user_id': userId,
          'fcm_token': token,
          'platform': _getPlatform(),
          'updated_at': DateTime.now().toIso8601String(),
        },
        onConflict: 'user_id, fcm_token',
      );
    } catch (_) {
      // Silent fail — notifications aren't critical to app function
    }
  }

  String _getPlatform() {
    // Simple platform detection
    try {
      return 'android'; // Default for now; could use Platform.isIOS
    } catch (_) {
      return 'unknown';
    }
  }

  /// Handle a message received while the app is in the foreground.
  /// Shows it as a local notification so the user still sees it.
  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'vouchsa_notifications',
          'VouchSA Notifications',
          icon: '@mipmap/ic_launcher',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: message.data['booking_id'],
    );
  }

  /// Handle when the user taps a notification (app was in background).
  void _handleNotificationTap(RemoteMessage message) {
    // The app's navigation will handle routing based on the notification data.
    // For now, just opening the app is enough — the user will see the
    // relevant booking/vouch in their notifications screen.
  }

  /// Handle when user taps a local notification (foreground notification).
  void _onNotificationTapped(NotificationResponse response) {
    // Same as above — the app opens and user can see the update.
  }

  /// Remove the FCM token when user logs out.
  /// This stops them from getting notifications on this device.
  Future<void> removeToken() async {
    final userId = _supabase.auth.currentUser?.id;
    final token = await _fcm.getToken();

    if (userId != null && token != null) {
      try {
        await _supabase
            .from('device_tokens')
            .delete()
            .eq('user_id', userId)
            .eq('fcm_token', token);
      } catch (_) {}
    }
  }
}
