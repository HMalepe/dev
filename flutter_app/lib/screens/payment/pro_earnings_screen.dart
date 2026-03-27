// ============================================
// Pro Earnings Dashboard
// ============================================
//
// WHAT IS THIS?
// The screen where pros see their money. Shows:
// - This week's earnings
// - Available balance (can be paid out)
// - "Request Payout" button
// - Payout history
//
// This is one of the most important screens in the app.
// If pros can't see their money and get paid, they won't use VouchSA.
//
// HOW PAYOUTS WORK:
// 1. Pro completes jobs → 90% of each job fee goes to their balance
// 2. Balance accumulates (e.g., R2,450 from 10 jobs)
// 3. Pro taps "Request Payout" (minimum R100)
// 4. VouchSA processes the bank transfer (via Yoco or manual EFT)
// 5. Money arrives in pro's bank account within 24 hours
//
// In the beginning (before you automate payouts), you might
// process payouts manually from your Yoco dashboard each day.
// That's fine — just make sure pros get paid reliably.
// ============================================

import 'package:flutter/material.dart';
import '../../services/payment_service.dart';
import '../../utils/constants.dart';

class ProEarningsScreen extends StatefulWidget {
  const ProEarningsScreen({super.key});

  @override
  State<ProEarningsScreen> createState() => _ProEarningsScreenState();
}

class _ProEarningsScreenState extends State<ProEarningsScreen> {
  final PaymentService _paymentService = PaymentService();

  EarningsSummary? _earnings;
  List<PayoutRecord> _payouts = [];
  bool _isLoading = true;
  bool _isRequesting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    final results = await Future.wait([
      _paymentService.getEarningsSummary(),
      _paymentService.getPayoutHistory(),
    ]);

    setState(() {
      _earnings = results[0] as EarningsSummary;
      _payouts = results[1] as List<PayoutRecord>;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Earnings'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ============================================
                    // EARNINGS OVERVIEW CARD
                    // ============================================
                    _buildEarningsCard(),
                    const SizedBox(height: 16),

                    // ============================================
                    // WEEKLY STATS
                    // ============================================
                    _buildWeeklyStats(),
                    const SizedBox(height: 24),

                    // ============================================
                    // PAYOUT BUTTON
                    // ============================================
                    _buildPayoutButton(),
                    const SizedBox(height: 24),

                    // ============================================
                    // PAYOUT HISTORY
                    // ============================================
                    _buildPayoutHistory(),
                  ],
                ),
              ),
            ),
    );
  }

  /// The big earnings card at the top.
  Widget _buildEarningsCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppConstants.primaryColor,
            AppConstants.primaryColor.withOpacity(0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppConstants.primaryColor.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Available Balance',
            style: TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            'R${_earnings?.availableBalance.toStringAsFixed(2) ?? "0.00"}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              // Total earnings
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Total Earned',
                      style: TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                    Text(
                      'R${_earnings?.totalEarnings.toStringAsFixed(0) ?? "0"}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              // Pending payout
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Pending Payout',
                      style: TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                    Text(
                      'R${_earnings?.pendingPayout.toStringAsFixed(0) ?? "0"}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// This week's performance stats.
  Widget _buildWeeklyStats() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'This Week',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  icon: Icons.payments,
                  label: 'Earned',
                  value: 'R${_earnings?.weeklyEarnings.toStringAsFixed(0) ?? "0"}',
                  color: Colors.green,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  icon: Icons.check_circle,
                  label: 'Jobs Done',
                  value: '${_earnings?.weeklyJobs ?? 0}',
                  color: AppConstants.accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  icon: Icons.workspace_premium,
                  label: 'Total Jobs',
                  value: '${_earnings?.totalJobs ?? 0}',
                  color: AppConstants.secondaryColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Payout request button.
  Widget _buildPayoutButton() {
    final balance = _earnings?.availableBalance ?? 0;
    final canPayout = balance >= AppConstants.minPayoutAmount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: canPayout && !_isRequesting
                ? () => _requestPayout(balance)
                : null,
            icon: const Icon(Icons.account_balance),
            label: Text(
              _isRequesting
                  ? 'Processing...'
                  : 'Request Payout (R${balance.toStringAsFixed(0)})',
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              disabledBackgroundColor: Colors.grey[300],
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          canPayout
              ? 'Money will be sent to your bank account within 24 hours.'
              : 'Minimum payout: R${AppConstants.minPayoutAmount.toStringAsFixed(0)}. '
                  'Complete more jobs to reach the threshold.',
          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// Payout history list.
  Widget _buildPayoutHistory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Payout History',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        if (_payouts.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Icon(Icons.receipt_long, size: 40, color: Colors.grey[300]),
                const SizedBox(height: 8),
                Text(
                  'No payouts yet',
                  style: TextStyle(color: Colors.grey[500]),
                ),
              ],
            ),
          )
        else
          ..._payouts.map((payout) => _PayoutTile(payout: payout)),
      ],
    );
  }

  /// Request a payout.
  Future<void> _requestPayout(double amount) async {
    // Confirm with the user
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Request Payout'),
        content: Text(
          'Send R${amount.toStringAsFixed(2)} to your bank account?\n\n'
          'This usually takes up to 24 hours.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isRequesting = true);

    final success = await _paymentService.requestPayout(amount);

    setState(() => _isRequesting = false);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payout requested! You\'ll receive it within 24 hours.'),
          backgroundColor: Colors.green,
        ),
      );
      _loadData(); // Refresh the data
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Failed to request payout. Please check your bank details in settings.',
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}

/// A small stat tile (used in the weekly stats section).
class _StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }
}

/// A single payout record in the history list.
class _PayoutTile extends StatelessWidget {
  final PayoutRecord payout;

  const _PayoutTile({required this.payout});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    IconData statusIcon;
    switch (payout.status) {
      case 'completed':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        break;
      case 'processing':
        statusColor = Colors.blue;
        statusIcon = Icons.sync;
        break;
      case 'failed':
        statusColor = Colors.red;
        statusIcon = Icons.error;
        break;
      default:
        statusColor = Colors.orange;
        statusIcon = Icons.hourglass_top;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(statusIcon, color: statusColor),
        title: Text(
          'R${payout.amount.toStringAsFixed(2)}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${payout.status[0].toUpperCase()}${payout.status.substring(1)} · '
          '${payout.requestedAt.day}/${payout.requestedAt.month}/${payout.requestedAt.year}',
        ),
        trailing: Icon(Icons.chevron_right, color: Colors.grey[400]),
      ),
    );
  }
}
