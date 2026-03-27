// ============================================
// Pro Profile Screen
// ============================================
//
// The FULL profile page for a service provider.
// Shown when a client taps "View Profile" on the preview card.
//
// Displays:
// - Hero section: photo, name, trust badge, vouch count
// - Voice/video intro player
// - Service menu (with prices)
// - Portfolio gallery (work photos)
// - Recent vouches from other clients
// - "Book Now" and "Add to Favorites" buttons
//
// WHAT IS A SCROLLVIEW?
// When content is taller than the screen, a ScrollView lets
// the user scroll up and down to see everything. Like scrolling
// a webpage — the content is longer than the visible area.
// ============================================

import 'package:flutter/material.dart';
import '../../services/pro_service.dart';
import '../../utils/constants.dart';
import '../../widgets/trust_badge.dart';
import '../../models/booking_model.dart';

class ProProfileScreen extends StatefulWidget {
  final String proUserId; // The pro's user ID (from the map pin)
  final String proName; // Show name in app bar while loading

  const ProProfileScreen({
    super.key,
    required this.proUserId,
    required this.proName,
  });

  @override
  State<ProProfileScreen> createState() => _ProProfileScreenState();
}

class _ProProfileScreenState extends State<ProProfileScreen> {
  final ProService _proService = ProService();

  // State
  ProDetail? _proDetail;
  bool _isLoading = true;
  bool _isFavorited = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProProfile();
  }

  /// Fetches the full pro profile from Supabase.
  Future<void> _loadProProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    // Fetch profile and favorite status at the same time
    final results = await Future.wait([
      _proService.fetchProDetail(widget.proUserId),
      _proService.isFavorited(widget.proUserId),
    ]);

    setState(() {
      _proDetail = results[0] as ProDetail?;
      _isFavorited = results[1] as bool;
      _isLoading = false;
      if (_proDetail == null) {
        _errorMessage = 'Could not load profile. Please try again.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // ============================================
      // APP BAR with pro name
      // ============================================
      appBar: AppBar(
        title: Text(widget.proName),
        actions: [
          // Favorite (heart) button
          IconButton(
            icon: Icon(
              _isFavorited ? Icons.favorite : Icons.favorite_border,
              color: _isFavorited ? Colors.red : null,
            ),
            onPressed: _toggleFavorite,
          ),
          // Share button
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              // TODO: Share pro profile link
            },
          ),
        ],
      ),

      // ============================================
      // BODY
      // ============================================
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildError()
              : _buildProfile(),

      // ============================================
      // BOTTOM "BOOK NOW" BAR
      // ============================================
      // Sticky at the bottom so it's always visible
      bottomNavigationBar: _proDetail != null
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  // Price info
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _proDetail!.profile.hourlyRate != null
                            ? 'From R${_proDetail!.profile.hourlyRate!.toStringAsFixed(0)}'
                            : 'Contact for pricing',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (_proDetail!.profile.hourlyRate != null)
                        Text(
                          'per hour',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  // Book Now button
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        // TODO: Navigate to booking flow
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Booking flow coming soon!'),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConstants.primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        _proDetail!.profile.isAvailableNow
                            ? 'Book Now'
                            : 'Schedule Booking',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }

  // ============================================
  // THE FULL PROFILE
  // ============================================
  Widget _buildProfile() {
    final profile = _proDetail!.userProfile;
    final proProfile = _proDetail!.profile;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ============================================
          // HERO SECTION (Photo, Name, Badge, Stats)
          // ============================================
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppConstants.primaryColor.withOpacity(0.05),
            ),
            child: Column(
              children: [
                // Profile photo
                CircleAvatar(
                  radius: 50,
                  backgroundColor: AppConstants.primaryColor.withOpacity(0.2),
                  backgroundImage: profile.profilePhotoUrl != null
                      ? NetworkImage(profile.profilePhotoUrl!)
                      : null,
                  child: profile.profilePhotoUrl == null
                      ? Text(
                          profile.displayName[0].toUpperCase(),
                          style: const TextStyle(fontSize: 36),
                        )
                      : null,
                ),
                const SizedBox(height: 12),

                // Name
                Text(
                  profile.displayName,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),

                // Trust badge
                TrustBadge(
                  certificationStatus: proProfile.certificationStatus,
                ),
                const SizedBox(height: 12),

                // Bio
                if (profile.bio != null && profile.bio!.isNotEmpty) ...[
                  Text(
                    profile.bio!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.grey[700],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Availability indicator
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: proProfile.isAvailableNow
                        ? Colors.green.withOpacity(0.1)
                        : Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: proProfile.isAvailableNow
                              ? Colors.green
                              : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        proProfile.isAvailableNow
                            ? 'Available Now'
                            : 'Currently Offline',
                        style: TextStyle(
                          color: proProfile.isAvailableNow
                              ? Colors.green[700]
                              : Colors.grey[600],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Stats row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildStat(
                      proProfile.vouchCount.toString(),
                      'Vouches',
                      Icons.verified_user,
                      Colors.green,
                    ),
                    _buildStat(
                      proProfile.totalJobsCompleted.toString(),
                      'Jobs Done',
                      Icons.check_circle,
                      AppConstants.accentColor,
                    ),
                    _buildStat(
                      '${proProfile.serviceRadiusKm}km',
                      'Radius',
                      Icons.radar,
                      Colors.orange,
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ============================================
          // SERVICE CATEGORIES (Tags)
          // ============================================
          if (proProfile.serviceCategories.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: proProfile.serviceCategories.map((category) {
                  final info = AppConstants.serviceCategories[category];
                  final color =
                      (info?['color'] as Color?) ?? AppConstants.handymanColor;
                  final label = (info?['label'] as String?) ?? category;
                  final icon =
                      (info?['icon'] as IconData?) ?? Icons.build;
                  return Chip(
                    avatar: Icon(icon, size: 16, color: color),
                    label: Text(label),
                    backgroundColor: color.withOpacity(0.1),
                    labelStyle: TextStyle(color: color),
                  );
                }).toList(),
              ),
            ),
          ],

          // ============================================
          // VOICE/VIDEO INTRO
          // ============================================
          if (profile.voiceIntroUrl != null ||
              profile.videoIntroUrl != null) ...[
            const _SectionHeader(title: 'Introduction'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                child: ListTile(
                  leading: Icon(
                    profile.videoIntroUrl != null
                        ? Icons.play_circle_filled
                        : Icons.mic,
                    color: AppConstants.primaryColor,
                    size: 40,
                  ),
                  title: Text(
                    profile.videoIntroUrl != null
                        ? 'Watch 30-second video intro'
                        : 'Listen to 30-second voice intro',
                  ),
                  subtitle: const Text('Tap to play'),
                  onTap: () {
                    // TODO: Play video/audio
                  },
                ),
              ),
            ),
          ],

          // ============================================
          // SERVICES MENU
          // ============================================
          if (_proDetail!.services.isNotEmpty) ...[
            const _SectionHeader(title: 'Services & Pricing'),
            ..._proDetail!.services.map((service) => _buildServiceItem(service)),
          ],

          // ============================================
          // PORTFOLIO (Work Samples)
          // ============================================
          if (_proDetail!.portfolio.isNotEmpty) ...[
            const _SectionHeader(title: 'Portfolio'),
            SizedBox(
              height: 200,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _proDetail!.portfolio.length,
                itemBuilder: (context, index) {
                  final image = _proDetail!.portfolio[index];
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Stack(
                        children: [
                          Image.network(
                            image.imageUrl,
                            width: 200,
                            height: 200,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 200,
                              height: 200,
                              color: Colors.grey[200],
                              child: const Icon(Icons.image, size: 40),
                            ),
                          ),
                          // "Verified" badge on client-verified photos
                          if (image.isVerified)
                            Positioned(
                              top: 8,
                              right: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.green,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.verified,
                                        size: 12, color: Colors.white),
                                    SizedBox(width: 4),
                                    Text(
                                      'Verified',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          // Caption at bottom
                          if (image.caption != null)
                            Positioned(
                              bottom: 0,
                              left: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Colors.black.withOpacity(0.7),
                                    ],
                                  ),
                                ),
                                child: Text(
                                  image.caption!,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          // ============================================
          // RECENT VOUCHES
          // ============================================
          if (_proDetail!.recentVouches.isNotEmpty) ...[
            _SectionHeader(
              title:
                  'Vouches (${_proDetail!.profile.vouchCount})',
            ),
            ..._proDetail!.recentVouches.map((vouch) => _buildVouchItem(vouch)),
          ],

          // Bottom padding
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  // ============================================
  // HELPER WIDGETS
  // ============================================

  /// A stat circle (used in the hero section).
  Widget _buildStat(String value, String label, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
      ],
    );
  }

  /// A row in the services menu.
  Widget _buildServiceItem(ProServiceModel service) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Card(
        child: ListTile(
          title: Text(
            service.serviceName,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (service.description != null)
                Text(service.description!),
              const SizedBox(height: 4),
              Text(
                '${service.durationMinutes} min',
                style: TextStyle(color: Colors.grey[500], fontSize: 12),
              ),
            ],
          ),
          trailing: Text(
            'R${service.price.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppConstants.primaryColor,
            ),
          ),
        ),
      ),
    );
  }

  /// A vouch card showing who vouched and what they said.
  Widget _buildVouchItem(VouchModel vouch) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Voucher's avatar
                  CircleAvatar(
                    radius: 16,
                    backgroundImage: vouch.voucherPhotoUrl != null
                        ? NetworkImage(vouch.voucherPhotoUrl!)
                        : null,
                    child: vouch.voucherPhotoUrl == null
                        ? Text(
                            (vouch.voucherName ?? '?')[0].toUpperCase(),
                            style: const TextStyle(fontSize: 12),
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  // Voucher name
                  Expanded(
                    child: Text(
                      vouch.voucherName ?? 'Anonymous',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  // Distance badge (if available)
                  if (vouch.distanceKm != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${vouch.distanceKm!.toStringAsFixed(1)}km from you',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.blue,
                        ),
                      ),
                    ),
                ],
              ),
              // Vouch text
              if (vouch.vouchText != null && vouch.vouchText!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  vouch.vouchText!,
                  style: TextStyle(
                    color: Colors.grey[700],
                    height: 1.4,
                  ),
                ),
              ],
              // Date
              const SizedBox(height: 6),
              Text(
                _formatDate(vouch.createdAt),
                style: TextStyle(fontSize: 11, color: Colors.grey[400]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Error state widget.
  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(_errorMessage!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadProProfile,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  /// Toggles whether this pro is in the client's favorites.
  Future<void> _toggleFavorite() async {
    if (_isFavorited) {
      await _proService.removeFromFavorites(widget.proUserId);
    } else {
      await _proService.addToFavorites(widget.proUserId);
    }
    setState(() => _isFavorited = !_isFavorited);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isFavorited
                ? '${widget.proName} added to My Pros!'
                : '${widget.proName} removed from My Pros',
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  /// Formats a DateTime into a readable string like "3 days ago" or "Jan 15".
  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';

    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[date.month - 1]} ${date.day}';
  }
}

/// A section header widget (used to label each section of the profile).
class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
