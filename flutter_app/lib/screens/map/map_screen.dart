// ============================================
// Map Screen - The Heart of VouchSA
// ============================================
//
// This is the MAIN screen of the app. Here's what it does:
//
// 1. Shows a Google Map centered on the user's location
// 2. Loads nearby available pros from Supabase
// 3. Shows each pro as a colored pin on the map:
//    - Red = Beauty (barbers, nail techs)
//    - Green = Gardening
//    - Blue = Cleaning
//    - Orange = Handyman/repairs
// 4. When you tap a pin, a preview card slides up from the bottom
// 5. Filter chips let you show only specific categories
// 6. For pros: a "Go Live" / "Go Offline" toggle button
//
// ARCHITECTURE (how the pieces connect):
// - MapProvider: fetches & manages pro data
// - LocationProvider: manages GPS
// - AuthProvider: knows if user is a client or pro
// - ProService: talks to Supabase
// - Google Maps: renders the actual map
// ============================================

import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/map_provider.dart';
import '../../services/pro_service.dart';
import '../../utils/constants.dart';
import '../../widgets/pro_preview_card.dart';
import '../booking/booking_flow_screen.dart';
import '../booking/bookings_list_screen.dart';
import '../chat/conversations_screen.dart';
import '../payment/pro_earnings_screen.dart';
import '../profile/pro_profile_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  // The Google Maps controller — lets us move the camera, add markers, etc.
  // "Completer" is a way to get this controller after the map finishes loading.
  final Completer<GoogleMapController> _mapController = Completer();

  // Track which bottom nav tab is selected
  int _currentIndex = 0;

  // Default camera position (Johannesburg) used while we wait for GPS
  static const LatLng _defaultPosition = LatLng(-26.2041, 28.0473);

  @override
  void initState() {
    super.initState();
    // After the screen builds, get location and load pros
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final locationProvider = context.read<LocationProvider>();
      final mapProvider = context.read<MapProvider>();

      // Step 1: Get the user's GPS location
      final position = await locationProvider.getCurrentLocation();

      // Step 2: If we got a location, load nearby pros
      if (position != null) {
        await mapProvider.loadNearbyPros(
          latitude: position.latitude,
          longitude: position.longitude,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final location = context.watch<LocationProvider>();
    final mapProvider = context.watch<MapProvider>();

    return Scaffold(
      // ============================================
      // APP BAR
      // ============================================
      appBar: AppBar(
        title: const Text(
          'VouchSA',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              // TODO: Navigate to notifications screen
            },
          ),
          // Earnings button (only for pros)
          if (auth.currentUser?.userType != 'client')
            IconButton(
              icon: const Icon(Icons.account_balance_wallet_outlined),
              tooltip: 'Earnings',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ProEarningsScreen(),
                  ),
                );
              },
            ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () {
              // TODO: Navigate to user's own profile/settings
            },
          ),
        ],
      ),

      // ============================================
      // BODY
      // ============================================
      body: _buildBody(_currentIndex, location, mapProvider),

      // ============================================
      // BOTTOM NAVIGATION BAR
      // ============================================
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Map',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_today),
            label: 'Bookings',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_outline),
            selectedIcon: Icon(Icons.favorite),
            label: 'My Pros',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_outlined),
            selectedIcon: Icon(Icons.chat),
            label: 'Chat',
          ),
        ],
      ),

      // ============================================
      // FLOATING ACTION BUTTON (Pro "Go Live" toggle)
      // ============================================
      // Only visible if the user is a pro or both.
      // Tapping it toggles their visibility on the map.
      floatingActionButton: _currentIndex == 0 &&
              auth.currentUser?.userType != 'client'
          ? FloatingActionButton.extended(
              onPressed: () => _toggleAvailability(location, mapProvider),
              icon: Icon(
                location.isTracking ? Icons.location_off : Icons.location_on,
              ),
              label: Text(
                location.isTracking ? 'Go Offline' : 'Go Live',
              ),
              backgroundColor:
                  location.isTracking ? Colors.red : AppConstants.primaryColor,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }

  // ============================================
  // TOGGLE PRO AVAILABILITY
  // ============================================
  // When a pro taps "Go Live":
  // 1. Start GPS tracking (send location every 30 seconds)
  // 2. Update database: is_available_now = true
  // 3. Their pin appears on other users' maps
  //
  // When they tap "Go Offline":
  // 1. Stop GPS tracking
  // 2. Update database: is_available_now = false
  // 3. Their pin disappears from the map

  Future<void> _toggleAvailability(
    LocationProvider location,
    MapProvider mapProvider,
  ) async {
    final proService = ProService();

    if (location.isTracking) {
      // Going OFFLINE
      location.stopTracking();
      await proService.toggleAvailability(isAvailable: false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You are now offline. Clients can\'t see you.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } else {
      // Going LIVE
      await location.startTracking();
      await proService.toggleAvailability(isAvailable: true);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You are now LIVE! Clients near you can see you.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  /// Builds the correct body widget based on the selected tab
  Widget _buildBody(
    int index,
    LocationProvider location,
    MapProvider mapProvider,
  ) {
    switch (index) {
      case 0:
        return _buildMapView(location, mapProvider);
      case 1:
        return _buildBookingsTab();
      case 2:
        return _buildMyProsPlaceholder();
      case 3:
        return _buildChatTab();
      default:
        return _buildMapView(location, mapProvider);
    }
  }

  // ============================================
  // THE MAP VIEW (Main tab)
  // ============================================
  Widget _buildMapView(LocationProvider location, MapProvider mapProvider) {
    // Show error if location failed
    if (location.errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.location_off, size: 64, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                location.errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => location.getCurrentLocation(),
                child: const Text('Enable Location'),
              ),
            ],
          ),
        ),
      );
    }

    // Show loading while getting GPS
    if (location.currentPosition == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Getting your location...'),
          ],
        ),
      );
    }

    // We have location! Show the map.
    final userLatLng = LatLng(location.latitude!, location.longitude!);

    return Stack(
      children: [
        // ============================================
        // GOOGLE MAP
        // ============================================
        GoogleMap(
          // Where the map starts (centered on user)
          initialCameraPosition: CameraPosition(
            target: userLatLng,
            zoom: 14.0, // Street-level zoom
          ),

          // Markers (pins) for each available pro
          markers: _buildProMarkers(mapProvider),

          // Map settings
          myLocationEnabled: true, // Blue dot for user's location
          myLocationButtonEnabled: false, // We'll make our own button
          zoomControlsEnabled: false, // Hide default +/- buttons
          mapToolbarEnabled: false, // Hide default navigation button
          compassEnabled: false,

          // When map finishes loading, save the controller
          onMapCreated: (GoogleMapController controller) {
            if (!_mapController.isCompleted) {
              _mapController.complete(controller);
            }
          },

          // When user taps empty space on map, close the preview card
          onTap: (_) {
            mapProvider.deselectPro();
          },
        ),

        // ============================================
        // SEARCH BAR (Floating on top of map)
        // ============================================
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const TextField(
              decoration: InputDecoration(
                hintText: 'Search for a service...',
                border: InputBorder.none,
                icon: Icon(Icons.search),
              ),
            ),
          ),
        ),

        // ============================================
        // CATEGORY FILTER CHIPS
        // ============================================
        Positioned(
          top: 80,
          left: 0,
          right: 0,
          child: SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: AppConstants.serviceCategories.entries.map((entry) {
                final isActive = mapProvider.activeFilters.contains(entry.key);
                final color = entry.value['color'] as Color;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(
                      entry.value['label'] as String,
                      style: TextStyle(
                        color: isActive ? Colors.white : Colors.black87,
                        fontWeight:
                            isActive ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                    avatar: Icon(
                      entry.value['icon'] as IconData,
                      size: 16,
                      color: isActive ? Colors.white : color,
                    ),
                    selected: isActive,
                    selectedColor: color,
                    backgroundColor: Colors.white,
                    checkmarkColor: Colors.white,
                    elevation: 2,
                    onSelected: (_) => mapProvider.toggleFilter(entry.key),
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // ============================================
        // PRO COUNT INDICATOR
        // ============================================
        // Shows "5 pros nearby" in top right corner
        Positioned(
          top: 130,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 6,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '${mapProvider.filteredPros.length} pro${mapProvider.filteredPros.length == 1 ? "" : "s"} nearby',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ============================================
        // "CENTER ON ME" BUTTON
        // ============================================
        Positioned(
          bottom: mapProvider.selectedPro != null ? 220 : 100,
          right: 16,
          child: FloatingActionButton.small(
            heroTag: 'center_map',
            onPressed: () async {
              final controller = await _mapController.future;
              controller.animateCamera(
                CameraUpdate.newLatLng(userLatLng),
              );
            },
            backgroundColor: Colors.white,
            child: const Icon(Icons.my_location, color: Colors.black87),
          ),
        ),

        // ============================================
        // "REFRESH" BUTTON
        // ============================================
        Positioned(
          bottom: mapProvider.selectedPro != null ? 270 : 150,
          right: 16,
          child: FloatingActionButton.small(
            heroTag: 'refresh_pros',
            onPressed: () => mapProvider.refreshPros(),
            backgroundColor: Colors.white,
            child: mapProvider.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh, color: Colors.black87),
          ),
        ),

        // ============================================
        // PRO PREVIEW CARD (slides up when pin is tapped)
        // ============================================
        if (mapProvider.selectedPro != null)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ProPreviewCard(
              pro: mapProvider.selectedPro!,
              onViewProfile: () {
                // Navigate to the pro's full profile
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProProfileScreen(
                      proUserId: mapProvider.selectedPro!.userId,
                      proName: mapProvider.selectedPro!.displayName,
                    ),
                  ),
                );
              },
              onBookNow: () async {
                final pro = mapProvider.selectedPro!;
                // Fetch the pro's services so the booking screen can list them
                final proService = ProService();
                final proDetail =
                    await proService.fetchProDetail(pro.userId);
                if (proDetail != null && context.mounted) {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => BookingFlowScreen(
                        proUserId: pro.userId,
                        proName: pro.displayName,
                        services: proDetail.services,
                        bookingType: 'instant',
                      ),
                    ),
                  );
                }
              },
              onClose: () => mapProvider.deselectPro(),
            ),
          ),
      ],
    );
  }

  // ============================================
  // BUILD MAP MARKERS (The Colored Pins)
  // ============================================
  // Converts each NearbyPro into a Google Maps marker.
  //
  // HOW MARKERS WORK:
  // Each marker has:
  // - A position (lat/lng)
  // - A color (based on service category)
  // - An onTap callback (shows the preview card)
  //
  // MARKER COLORS:
  // Google Maps has preset hue values:
  // Red=0, Orange=30, Yellow=60, Green=120, Blue=240, Violet=270
  // We map our category colors to these hues.

  Set<Marker> _buildProMarkers(MapProvider mapProvider) {
    return mapProvider.filteredPros.map((pro) {
      // Determine pin color based on primary service category
      final double hue = _getCategoryHue(pro.primaryCategory);

      return Marker(
        // Every marker needs a unique ID
        markerId: MarkerId(pro.userId),

        // Where to place the pin
        position: LatLng(pro.latitude, pro.longitude),

        // Pin color
        icon: BitmapDescriptor.defaultMarkerWithHue(hue),

        // What happens when user taps the pin
        onTap: () {
          mapProvider.selectPro(pro);
          // Animate the map camera to center on this pro
          _animateToPosition(LatLng(pro.latitude, pro.longitude));
        },

        // Info window (the little bubble above the pin)
        // We use our custom preview card instead, but this shows on long-press
        infoWindow: InfoWindow(
          title: pro.displayName,
          snippet:
              '${pro.vouchCount} vouches · ${pro.distanceKm.toStringAsFixed(1)}km away',
        ),
      );
    }).toSet();
  }

  /// Converts a service category to a Google Maps marker hue value.
  double _getCategoryHue(String category) {
    switch (category) {
      case 'barber':
      case 'nail_tech':
        return BitmapDescriptor.hueRed; // Red for beauty
      case 'gardener':
        return BitmapDescriptor.hueGreen; // Green for garden
      case 'cleaner':
        return BitmapDescriptor.hueAzure; // Blue for cleaning
      case 'handyman':
      case 'painter':
      case 'plumber':
      case 'electrician':
        return BitmapDescriptor.hueOrange; // Orange for handyman
      default:
        return BitmapDescriptor.hueViolet; // Purple for other
    }
  }

  /// Smoothly moves the map camera to a position.
  Future<void> _animateToPosition(LatLng position) async {
    final controller = await _mapController.future;
    controller.animateCamera(
      CameraUpdate.newLatLngZoom(position, 15.0),
    );
  }

  // ============================================
  // TAB SCREENS
  // ============================================

  /// Bookings tab — shows all active and past bookings.
  Widget _buildBookingsTab() {
    final auth = context.read<AuthProvider>();
    return BookingsListScreen(
      isPro: auth.currentUser?.userType == 'pro',
    );
  }

  /// My Pros tab — shows favorited pros.
  /// TODO: Build a dedicated favorites screen. For now, placeholder.
  Widget _buildMyProsPlaceholder() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.favorite, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text('My Pros', style: TextStyle(fontSize: 18)),
          SizedBox(height: 8),
          Text(
            'Your favorite service providers will appear here.',
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  /// Chat tab — shows all active conversations.
  Widget _buildChatTab() {
    return const ConversationsScreen();
  }
}
