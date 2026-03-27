// ============================================
// Trust Badge Widget
// ============================================
//
// Displays the trust level of a pro:
// - "New Pro" (green) — 0-9 vouches
// - "Trusted" (blue) — 10+ vouches, 85%+ vouch rate
// - "Certified Pro" (gold) — 25+ vouches, 90%+ rate
//
// Used on profile screens, preview cards, and search results.
// ============================================

import 'package:flutter/material.dart';
import '../utils/constants.dart';

class TrustBadge extends StatelessWidget {
  final String certificationStatus; // 'new', 'trusted', or 'certified'
  final bool showIcon;
  final double fontSize;

  const TrustBadge({
    super.key,
    required this.certificationStatus,
    this.showIcon = true,
    this.fontSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    final badgeInfo = AppConstants.trustBadges[certificationStatus] ??
        AppConstants.trustBadges['new']!;
    final label = badgeInfo['label'] as String;
    final color = badgeInfo['color'] as Color;

    // Pick the right icon for each trust level
    IconData icon;
    switch (certificationStatus) {
      case 'certified':
        icon = Icons.workspace_premium; // Gold medal
        break;
      case 'trusted':
        icon = Icons.verified; // Blue check
        break;
      default:
        icon = Icons.fiber_new; // "New" badge
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showIcon) ...[
            Icon(icon, size: fontSize + 2, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
