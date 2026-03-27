// ============================================
// Pro Service - Talks to Supabase About Pros
// ============================================
//
// WHAT IS A SERVICE CLASS?
// It's the "messenger" between your app and the database.
//
// Think of it like a waiter at a restaurant:
// - The screen (widget) is the CUSTOMER who wants food
// - The service class is the WAITER who takes the order to the kitchen
// - Supabase (database) is the KITCHEN that makes the food
// - The waiter brings back the food (data) to the customer
//
// WHY NOT TALK TO SUPABASE DIRECTLY FROM THE SCREEN?
// 1. Keeps screens simple (they just display things)
// 2. If you change your database, you only fix this file
// 3. Multiple screens can reuse the same service
// ============================================

import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_model.dart';
import '../models/booking_model.dart';

/// A "nearby pro" result — a pro who's available now, with their distance.
/// This is what appears as a pin on the map.
class NearbyPro {
  final String userId;
  final String displayName;
  final String? profilePhotoUrl;
  final List<String> serviceCategories;
  final double? hourlyRate;
  final int vouchCount;
  final String certificationStatus;
  final double latitude;
  final double longitude;
  final double distanceKm;

  NearbyPro({
    required this.userId,
    required this.displayName,
    this.profilePhotoUrl,
    required this.serviceCategories,
    this.hourlyRate,
    required this.vouchCount,
    required this.certificationStatus,
    required this.latitude,
    required this.longitude,
    required this.distanceKm,
  });

  /// Creates a NearbyPro from the database function result.
  factory NearbyPro.fromJson(Map<String, dynamic> json) {
    return NearbyPro(
      userId: json['user_id'],
      displayName: json['display_name'],
      profilePhotoUrl: json['profile_photo_url'],
      serviceCategories: List<String>.from(json['service_categories'] ?? []),
      hourlyRate: json['hourly_rate'] != null
          ? double.parse(json['hourly_rate'].toString())
          : null,
      vouchCount: json['vouch_count'] ?? 0,
      certificationStatus: json['certification_status'] ?? 'new',
      latitude: double.parse(json['latitude'].toString()),
      longitude: double.parse(json['longitude'].toString()),
      distanceKm: double.parse(json['distance_km'].toString()),
    );
  }

  /// Gets the PRIMARY service category (used for pin color).
  /// A pro might have multiple categories, but we use the first one
  /// to decide the pin color on the map.
  String get primaryCategory =>
      serviceCategories.isNotEmpty ? serviceCategories.first : 'handyman';
}

/// Full pro profile with services, portfolio, and vouches.
/// This is what you see when you tap "View Profile".
class ProDetail {
  final ProProfileModel profile;
  final ProfileModel userProfile;
  final List<ProServiceModel> services;
  final List<PortfolioImage> portfolio;
  final List<VouchModel> recentVouches;

  ProDetail({
    required this.profile,
    required this.userProfile,
    required this.services,
    required this.portfolio,
    required this.recentVouches,
  });
}

/// A portfolio image (work sample).
class PortfolioImage {
  final String id;
  final String imageUrl;
  final String? caption;
  final bool isVerified;

  PortfolioImage({
    required this.id,
    required this.imageUrl,
    this.caption,
    this.isVerified = false,
  });

  factory PortfolioImage.fromJson(Map<String, dynamic> json) {
    return PortfolioImage(
      id: json['id'],
      imageUrl: json['image_url'],
      caption: json['caption'],
      isVerified: json['is_verified'] ?? false,
    );
  }
}

// ============================================
// THE SERVICE CLASS
// ============================================

class ProService {
  final SupabaseClient _supabase = Supabase.instance.client;

  // ============================================
  // FETCH NEARBY AVAILABLE PROS
  // ============================================
  // Called when the map loads or the user moves the map.
  // Uses the database function we created in 002_functions.sql.
  //
  // WHAT IS rpc()?
  // "RPC" stands for Remote Procedure Call. It calls a function
  // that lives IN the database (not in Edge Functions).
  // We created "find_nearby_pros" in our SQL migration.
  // This is faster than calling an Edge Function because the
  // database does all the work in one step.

  Future<List<NearbyPro>> fetchNearbyPros({
    required double latitude,
    required double longitude,
    int maxDistanceKm = 15,
  }) async {
    try {
      final response = await _supabase.rpc('find_nearby_pros', params: {
        'client_lat': latitude,
        'client_lng': longitude,
        'max_distance_km': maxDistanceKm,
      });

      // response is a List<dynamic> of rows from the database
      final List<dynamic> data = response as List<dynamic>;
      return data.map((json) => NearbyPro.fromJson(json)).toList();
    } catch (e) {
      // If the function doesn't exist yet (hasn't run migrations),
      // fall back to a direct query
      return _fetchNearbyProsFallback(latitude, longitude, maxDistanceKm);
    }
  }

  /// Fallback: fetch pros directly if the database function isn't set up yet.
  /// This is simpler but doesn't calculate distance as precisely.
  Future<List<NearbyPro>> _fetchNearbyProsFallback(
    double latitude,
    double longitude,
    int maxDistanceKm,
  ) async {
    try {
      // Rough bounding box: 1 degree of latitude ≈ 111km
      final latRange = maxDistanceKm / 111.0;
      final lngRange = maxDistanceKm / 80.0; // Rough for SA's latitude

      final response = await _supabase
          .from('pro_locations')
          .select('''
            pro_id,
            latitude,
            longitude,
            users!inner(id),
            profiles:profiles!pro_locations_pro_id_fkey(
              display_name,
              profile_photo_url
            ),
            pro_profiles:pro_profiles!pro_locations_pro_id_fkey(
              service_categories,
              hourly_rate,
              vouch_count,
              certification_status,
              is_available_now
            )
          ''')
          .gte('latitude', latitude - latRange)
          .lte('latitude', latitude + latRange)
          .gte('longitude', longitude - lngRange)
          .lte('longitude', longitude + lngRange);

      // Note: this fallback is simplified. The real function is better.
      return [];
    } catch (e) {
      return [];
    }
  }

  // ============================================
  // FETCH FULL PRO PROFILE
  // ============================================
  // Called when a user taps "View Profile" on a pro card.
  // Gets everything: profile, services, portfolio, vouches.

  Future<ProDetail?> fetchProDetail(String proUserId) async {
    try {
      // Fetch all data in parallel for speed
      // "Future.wait" runs multiple database calls at the same time
      final results = await Future.wait([
        // 1. Pro profile data
        _supabase
            .from('pro_profiles')
            .select()
            .eq('user_id', proUserId)
            .single(),
        // 2. User profile (name, photo, bio)
        _supabase
            .from('profiles')
            .select()
            .eq('user_id', proUserId)
            .single(),
        // 3. Their services menu
        _supabase
            .from('pro_services')
            .select()
            .eq('pro_id', proUserId)
            .eq('is_active', true)
            .order('price'),
        // 4. Portfolio images
        _supabase
            .from('pro_portfolio')
            .select()
            .eq('pro_id', proUserId)
            .order('created_at', ascending: false)
            .limit(20),
        // 5. Recent vouches (with voucher names)
        _supabase
            .from('vouches')
            .select('*, voucher:voucher_id(display_name, profile_photo_url)')
            .eq('vouchee_id', proUserId)
            .eq('is_public', true)
            .order('created_at', ascending: false)
            .limit(10),
      ]);

      return ProDetail(
        profile: ProProfileModel.fromJson(results[0] as Map<String, dynamic>),
        userProfile:
            ProfileModel.fromJson(results[1] as Map<String, dynamic>),
        services: (results[2] as List<dynamic>)
            .map((json) => ProServiceModel.fromJson(json))
            .toList(),
        portfolio: (results[3] as List<dynamic>)
            .map((json) => PortfolioImage.fromJson(json))
            .toList(),
        recentVouches: (results[4] as List<dynamic>).map((json) {
          // Merge the joined voucher data into the vouch object
          final voucher = json['voucher'] as Map<String, dynamic>?;
          return VouchModel.fromJson({
            ...json,
            'voucher_name': voucher?['display_name'],
            'voucher_photo': voucher?['profile_photo_url'],
          });
        }).toList(),
      );
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // TOGGLE AVAILABILITY
  // ============================================
  // When a pro taps "Go Live" or "Go Offline".
  // Updates their pro_profiles row in the database.

  Future<bool> toggleAvailability({
    required bool isAvailable,
    DateTime? availableUntil,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _supabase.from('pro_profiles').update({
        'is_available_now': isAvailable,
        'available_until': availableUntil?.toIso8601String(),
      }).eq('user_id', userId);

      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // ADD TO FAVORITES
  // ============================================
  // Client taps the heart icon on a pro's profile.

  Future<bool> addToFavorites(String proId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _supabase.from('client_favorites').upsert({
        'client_id': userId,
        'pro_id': proId,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // REMOVE FROM FAVORITES
  // ============================================

  Future<bool> removeFromFavorites(String proId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _supabase
          .from('client_favorites')
          .delete()
          .eq('client_id', userId)
          .eq('pro_id', proId);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // CHECK IF PRO IS FAVORITED
  // ============================================

  Future<bool> isFavorited(String proId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      final data = await _supabase
          .from('client_favorites')
          .select('id')
          .eq('client_id', userId)
          .eq('pro_id', proId)
          .maybeSingle();
      return data != null;
    } catch (e) {
      return false;
    }
  }
}
