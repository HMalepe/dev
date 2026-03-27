// ============================================
// Map Provider - Manages Map State & Pro Data
// ============================================
//
// This provider handles:
// 1. Fetching nearby pros from Supabase
// 2. Filtering pros by category
// 3. Subscribing to real-time location updates
// 4. Managing the selected pro (when user taps a pin)
//
// WHAT IS REAL-TIME?
// Normally, to see new data you'd refresh the page. With real-time,
// Supabase PUSHES updates to your app automatically. So when a pro
// moves or a new pro goes live, their pin appears/moves on the map
// WITHOUT the client needing to refresh. Like WhatsApp showing
// "typing..." — it happens live.
// ============================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/pro_service.dart';

class MapProvider extends ChangeNotifier {
  final ProService _proService = ProService();
  final SupabaseClient _supabase = Supabase.instance.client;

  // ============================================
  // STATE (the data this provider manages)
  // ============================================

  // All nearby pros currently shown on the map
  List<NearbyPro> _nearbyPros = [];

  // The currently selected pro (when user taps a pin)
  NearbyPro? _selectedPro;

  // Active category filters (empty = show all)
  Set<String> _activeFilters = {};

  // Loading/error states
  bool _isLoading = false;
  String? _errorMessage;

  // Real-time subscription (so we can cancel it later)
  RealtimeChannel? _locationChannel;

  // Last known client position (to refresh when needed)
  double? _lastLat;
  double? _lastLng;

  // ============================================
  // GETTERS (how screens read the state)
  // ============================================

  List<NearbyPro> get nearbyPros => _nearbyPros;
  NearbyPro? get selectedPro => _selectedPro;
  Set<String> get activeFilters => _activeFilters;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Returns pros filtered by active category filters.
  /// If no filters are active, returns all pros.
  List<NearbyPro> get filteredPros {
    if (_activeFilters.isEmpty) return _nearbyPros;

    return _nearbyPros.where((pro) {
      // Show the pro if ANY of their categories match ANY active filter
      return pro.serviceCategories.any(
        (category) => _activeFilters.contains(category),
      );
    }).toList();
  }

  // ============================================
  // LOAD NEARBY PROS
  // ============================================
  // Called when the map first loads, or when the user moves
  // the map significantly (more than ~1km).
  //
  // FLOW:
  // 1. Gets the user's current GPS coordinates
  // 2. Calls the database function "find_nearby_pros"
  // 3. Returns a list of available pros with their distance
  // 4. The map screen turns these into colored pins

  Future<void> loadNearbyPros({
    required double latitude,
    required double longitude,
    int maxDistanceKm = 15,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    _lastLat = latitude;
    _lastLng = longitude;
    notifyListeners();

    try {
      _nearbyPros = await _proService.fetchNearbyPros(
        latitude: latitude,
        longitude: longitude,
        maxDistanceKm: maxDistanceKm,
      );

      _isLoading = false;
      notifyListeners();

      // Start listening for real-time location changes
      _subscribeToLocationUpdates();
    } catch (e) {
      _isLoading = false;
      _errorMessage = 'Could not load nearby pros. Pull down to retry.';
      notifyListeners();
    }
  }

  // ============================================
  // REFRESH PROS
  // ============================================
  // Re-fetches using the last known coordinates.

  Future<void> refreshPros() async {
    if (_lastLat != null && _lastLng != null) {
      await loadNearbyPros(latitude: _lastLat!, longitude: _lastLng!);
    }
  }

  // ============================================
  // SELECT / DESELECT A PRO (Tap pin on map)
  // ============================================

  void selectPro(NearbyPro pro) {
    _selectedPro = pro;
    notifyListeners();
  }

  void deselectPro() {
    _selectedPro = null;
    notifyListeners();
  }

  // ============================================
  // TOGGLE CATEGORY FILTER
  // ============================================
  // When user taps a filter chip (e.g., "Barber"),
  // we add or remove that category from the active filters.
  // The map immediately shows/hides relevant pins.

  void toggleFilter(String category) {
    if (_activeFilters.contains(category)) {
      _activeFilters.remove(category);
    } else {
      _activeFilters.add(category);
    }
    notifyListeners(); // Map will rebuild with filtered pins
  }

  void clearFilters() {
    _activeFilters.clear();
    notifyListeners();
  }

  // ============================================
  // REAL-TIME LOCATION UPDATES
  // ============================================
  // Subscribes to changes in the pro_locations table.
  // When a pro's GPS updates (every 30 seconds), or when
  // a new pro goes live, we get notified and update the map.
  //
  // HOW IT WORKS:
  // Supabase keeps a persistent connection (WebSocket) open.
  // When data changes in pro_locations, Supabase sends us
  // the new data through that connection. No polling needed.

  void _subscribeToLocationUpdates() {
    // Cancel any existing subscription first
    _locationChannel?.unsubscribe();

    _locationChannel = _supabase
        .channel('pro_locations_changes')
        .onPostgresChanges(
          event: PostgresChangeEvent.all, // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pro_locations',
          callback: (payload) {
            // A pro's location changed — refresh the map
            // We debounce this (wait a bit before refreshing) because
            // multiple pros might update at the same time
            _debounceRefresh();
          },
        )
        .subscribe();
  }

  // Debounce timer — prevents refreshing 50 times per second
  Timer? _debounceTimer;

  void _debounceRefresh() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(seconds: 3), () {
      refreshPros();
    });
  }

  // ============================================
  // CLEAN UP
  // ============================================
  // Called when the provider is destroyed (user closes the map).
  // ALWAYS clean up subscriptions to prevent memory leaks!

  @override
  void dispose() {
    _locationChannel?.unsubscribe();
    _debounceTimer?.cancel();
    super.dispose();
  }
}
