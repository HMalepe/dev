// ============================================
// Pro Preview Card Widget
// ============================================
//
// WHAT IS THIS?
// The card that slides up from the bottom when you tap a pro's
// pin on the map. It shows a quick summary:
// - Photo, name, trust badge
// - Primary service category
// - Distance from you
// - Vouch count
// - Price
// - "View Profile" and "Book Now" buttons
//
// WHAT IS A WIDGET?
// Everything you see on screen in Flutter is a widget.
// A button is a widget. Text is a widget. A card is a widget.
// You build screens by combining widgets like Lego blocks.
// ============================================

import 'package:flutter/material.dart';
import '../services/pro_service.dart';
import '../utils/constants.dart';

class ProPreviewCard extends StatelessWidget {
  final NearbyPro pro;
  final VoidCallback onViewProfile; // What happens when they tap "View Profile"
  final VoidCallback onBookNow; // What happens when they tap "Book Now"
  final VoidCallback onClose; // What happens when they tap X to close the card

  const ProPreviewCard({
    super.key,
    required this.pro,
    required this.onViewProfile,
    required this.onBookNow,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    // Look up the category info (color, icon, label)
    final categoryInfo = AppConstants.serviceCategories[pro.primaryCategory];
    final categoryColor =
        (categoryInfo?['color'] as Color?) ?? AppConstants.handymanColor;
    final categoryIcon =
        (categoryInfo?['icon'] as IconData?) ?? Icons.build;
    final categoryLabel =
        (categoryInfo?['label'] as String?) ?? 'Service Pro';

    // Look up trust badge info
    final badgeInfo = AppConstants.trustBadges[pro.certificationStatus];
    final badgeLabel = (badgeInfo?['label'] as String?) ?? 'New Pro';
    final badgeColor =
        (badgeInfo?['color'] as Color?) ?? Colors.green;

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min, // Only take up as much space as needed
        children: [
          // ============================================
          // TOP SECTION: Photo, Name, Badge, Distance
          // ============================================
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 12),
            child: Row(
              children: [
                // Profile photo (or placeholder)
                CircleAvatar(
                  radius: 30,
                  backgroundColor: categoryColor.withOpacity(0.2),
                  backgroundImage: pro.profilePhotoUrl != null
                      ? NetworkImage(pro.profilePhotoUrl!)
                      : null,
                  child: pro.profilePhotoUrl == null
                      ? Icon(categoryIcon, color: categoryColor, size: 28)
                      : null,
                ),
                const SizedBox(width: 12),

                // Name, category, and distance
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name + trust badge
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              pro.displayName,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          // Trust badge chip
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: badgeColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              badgeLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: badgeColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Category and distance
                      Row(
                        children: [
                          Icon(categoryIcon, size: 14, color: categoryColor),
                          const SizedBox(width: 4),
                          Text(
                            categoryLabel,
                            style: TextStyle(
                              color: categoryColor,
                              fontWeight: FontWeight.w500,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Icon(Icons.location_on,
                              size: 14, color: Colors.grey[500]),
                          const SizedBox(width: 2),
                          Text(
                            '${pro.distanceKm.toStringAsFixed(1)} km away',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Close button
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: onClose,
                  color: Colors.grey[400],
                ),
              ],
            ),
          ),

          // ============================================
          // MIDDLE SECTION: Vouches and Price
          // ============================================
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                // Vouch count
                Icon(Icons.verified_user, size: 16, color: Colors.green[600]),
                const SizedBox(width: 4),
                Text(
                  'Vouched by ${pro.vouchCount} ${pro.vouchCount == 1 ? "person" : "people"}',
                  style: TextStyle(
                    color: Colors.green[700],
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                // Hourly rate
                if (pro.hourlyRate != null) ...[
                  Text(
                    'From R${pro.hourlyRate!.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '/hr',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ============================================
          // BOTTOM SECTION: Action Buttons
          // ============================================
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                // "View Profile" button (outline style)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onViewProfile,
                    icon: const Icon(Icons.person_outline, size: 18),
                    label: const Text('View Profile'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // "Book Now" button (filled style)
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onBookNow,
                    icon: const Icon(Icons.calendar_today, size: 18),
                    label: const Text('Book Now'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppConstants.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
