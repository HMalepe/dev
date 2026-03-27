// ============================================
// Payment Service - Yoco Integration
// ============================================
//
// HOW PAYMENTS WORK IN VOUCHSA (Step by Step):
//
// 1. CLIENT BOOKS A PRO
//    → We show the Yoco checkout page in a WebView
//    → Client enters their card details on Yoco's secure page
//    → Yoco creates a "charge" and gives us a payment ID
//    → We save that payment ID in our transactions table
//    → Money is now held by Yoco (not captured yet)
//
// 2. PRO STARTS THE JOB
//    → We tell Yoco to "capture" the payment
//    → This actually charges the client's card
//    → Money moves from client → Yoco's holding account
//
// 3. PRO COMPLETES THE JOB
//    → We calculate: 90% to pro, 10% to VouchSA
//    → We record the payout in our database
//    → Actual bank transfer happens via Yoco's payout API
//      (or manually in the beginning)
//
// 4. IF THERE'S A DISPUTE
//    → Payment stays on hold
//    → Admin resolves it
//    → Either releases to pro or refunds to client
//
// WHAT IS YOCO?
// South Africa's most popular payment processor for small businesses.
// They handle all the scary card security stuff (PCI compliance).
// Your app NEVER sees or stores the client's card number.
// Instead, Yoco shows their own secure checkout page.
//
// YOCO PRICING: 2.95% per transaction (they take this from each charge)
// ============================================

import 'package:supabase_flutter/supabase_flutter.dart';
import '../utils/constants.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

/// Result of creating a Yoco checkout session.
class CheckoutResult {
  final String checkoutId;
  final String redirectUrl; // URL to show in WebView
  final String transactionId; // Our internal transaction ID

  CheckoutResult({
    required this.checkoutId,
    required this.redirectUrl,
    required this.transactionId,
  });
}

/// A payout record for a pro.
class PayoutRecord {
  final String id;
  final double amount;
  final String status; // 'pending', 'processing', 'completed', 'failed'
  final DateTime requestedAt;
  final DateTime? completedAt;

  PayoutRecord({
    required this.id,
    required this.amount,
    required this.status,
    required this.requestedAt,
    this.completedAt,
  });

  factory PayoutRecord.fromJson(Map<String, dynamic> json) {
    return PayoutRecord(
      id: json['id'],
      amount: double.parse(json['amount'].toString()),
      status: json['status'],
      requestedAt: DateTime.parse(json['requested_at']),
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'])
          : null,
    );
  }
}

/// Earnings summary for a pro.
class EarningsSummary {
  final double totalEarnings; // All-time earnings
  final double weeklyEarnings; // This week
  final double pendingPayout; // Earned but not yet paid out
  final double availableBalance; // Can request payout
  final int totalJobs;
  final int weeklyJobs;

  EarningsSummary({
    required this.totalEarnings,
    required this.weeklyEarnings,
    required this.pendingPayout,
    required this.availableBalance,
    required this.totalJobs,
    required this.weeklyJobs,
  });
}

class PaymentService {
  final SupabaseClient _supabase = Supabase.instance.client;

  String get _currentUserId => _supabase.auth.currentUser!.id;

  // ============================================
  // CREATE YOCO CHECKOUT SESSION
  // ============================================
  // Called when the client confirms a booking.
  // Creates a Yoco checkout URL that we show in a WebView.
  //
  // HOW IT WORKS:
  // 1. We call our Supabase Edge Function (NOT Yoco directly)
  // 2. The Edge Function calls Yoco's API with our secret key
  // 3. Yoco returns a checkout URL
  // 4. We show that URL in a WebView
  // 5. Client enters card details on Yoco's secure page
  // 6. Yoco redirects back to our app with a success/failure status
  //
  // WHY USE AN EDGE FUNCTION?
  // The Yoco secret key must NEVER be in the app code (anyone could
  // decompile the app and steal it). The Edge Function runs on the
  // server where the secret key is safe.

  Future<CheckoutResult?> createCheckout({
    required String bookingId,
    required double amount,
    required String description,
  }) async {
    try {
      // Call our Edge Function that creates the Yoco checkout
      final response = await _supabase.functions.invoke(
        'payments',
        body: {
          'action': 'create_checkout',
          'booking_id': bookingId,
          'amount': amount,
          'description': description,
          'currency': 'ZAR', // South African Rand
        },
      );

      if (response.status != 200) {
        return null;
      }

      final data = jsonDecode(response.data);

      return CheckoutResult(
        checkoutId: data['checkout_id'],
        redirectUrl: data['redirect_url'],
        transactionId: data['transaction_id'],
      );
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // VERIFY PAYMENT
  // ============================================
  // Called after the client completes the Yoco checkout.
  // Checks with our Edge Function if the payment was successful.

  Future<bool> verifyPayment({
    required String bookingId,
    required String checkoutId,
  }) async {
    try {
      final response = await _supabase.functions.invoke(
        'payments',
        body: {
          'action': 'verify_payment',
          'booking_id': bookingId,
          'checkout_id': checkoutId,
        },
      );

      if (response.status != 200) return false;

      final data = jsonDecode(response.data);
      return data['status'] == 'successful';
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // GET EARNINGS SUMMARY (For Pros)
  // ============================================
  // Shows the pro how much they've earned, what's pending, etc.

  Future<EarningsSummary> getEarningsSummary() async {
    try {
      // Get total earnings from pro_profiles
      final profile = await _supabase
          .from('pro_profiles')
          .select('total_earnings, total_jobs_completed')
          .eq('user_id', _currentUserId)
          .single();

      // Get this week's earnings (completed bookings from last 7 days)
      final weekAgo = DateTime.now()
          .subtract(const Duration(days: 7))
          .toIso8601String();

      final weeklyBookings = await _supabase
          .from('bookings')
          .select('service_price')
          .eq('pro_id', _currentUserId)
          .eq('status', 'completed')
          .gte('actual_end', weekAgo);

      double weeklyEarnings = 0;
      for (final booking in weeklyBookings) {
        weeklyEarnings += double.parse(booking['service_price'].toString());
      }

      // Get total payouts already made
      final payouts = await _supabase
          .from('pro_payouts')
          .select('amount')
          .eq('pro_id', _currentUserId)
          .eq('status', 'completed');

      double totalPaidOut = 0;
      for (final payout in payouts) {
        totalPaidOut += double.parse(payout['amount'].toString());
      }

      // Get pending payouts
      final pendingPayouts = await _supabase
          .from('pro_payouts')
          .select('amount')
          .eq('pro_id', _currentUserId)
          .inFilter('status', ['pending', 'processing']);

      double pendingAmount = 0;
      for (final payout in pendingPayouts) {
        pendingAmount += double.parse(payout['amount'].toString());
      }

      final totalEarnings =
          double.parse(profile['total_earnings'].toString());
      final availableBalance = totalEarnings - totalPaidOut - pendingAmount;

      return EarningsSummary(
        totalEarnings: totalEarnings,
        weeklyEarnings: weeklyEarnings,
        pendingPayout: pendingAmount,
        availableBalance: availableBalance > 0 ? availableBalance : 0,
        totalJobs: profile['total_jobs_completed'] ?? 0,
        weeklyJobs: weeklyBookings.length,
      );
    } catch (e) {
      return EarningsSummary(
        totalEarnings: 0,
        weeklyEarnings: 0,
        pendingPayout: 0,
        availableBalance: 0,
        totalJobs: 0,
        weeklyJobs: 0,
      );
    }
  }

  // ============================================
  // REQUEST PAYOUT
  // ============================================
  // Pro requests their earned money to be sent to their bank.
  // Minimum payout: R100

  Future<bool> requestPayout(double amount) async {
    if (amount < AppConstants.minPayoutAmount) return false;

    try {
      // Get pro's bank details
      final profile = await _supabase
          .from('pro_profiles')
          .select('bank_account_number, bank_name, bank_branch_code')
          .eq('user_id', _currentUserId)
          .single();

      if (profile['bank_account_number'] == null) {
        return false; // No bank details set up
      }

      // Create payout request
      await _supabase.from('pro_payouts').insert({
        'pro_id': _currentUserId,
        'amount': amount,
        'status': 'pending',
        'bank_account_number': profile['bank_account_number'],
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // GET PAYOUT HISTORY
  // ============================================

  Future<List<PayoutRecord>> getPayoutHistory() async {
    try {
      final data = await _supabase
          .from('pro_payouts')
          .select()
          .eq('pro_id', _currentUserId)
          .order('requested_at', ascending: false)
          .limit(50);

      return (data as List<dynamic>)
          .map((json) => PayoutRecord.fromJson(json))
          .toList();
    } catch (e) {
      return [];
    }
  }

  // ============================================
  // GET TRANSACTION HISTORY
  // ============================================
  // Shows all payment transactions for a user (client or pro).

  Future<List<Map<String, dynamic>>> getTransactionHistory() async {
    try {
      final data = await _supabase
          .from('transactions')
          .select('*, bookings!inner(client_id, pro_id)')
          .or('bookings.client_id.eq.$_currentUserId,bookings.pro_id.eq.$_currentUserId')
          .order('created_at', ascending: false)
          .limit(50);

      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      return [];
    }
  }
}
