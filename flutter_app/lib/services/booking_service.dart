// ============================================
// Booking Service - Handles the Booking Lifecycle
// ============================================
//
// This service manages the entire booking flow:
// 1. Client creates a booking (instant or scheduled)
// 2. Pro accepts or declines
// 3. Pro starts the job
// 4. Pro completes the job
// 5. Client vouches for the pro
//
// Each step talks to Supabase and returns a result.
// ============================================

import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/booking_model.dart';
import '../utils/constants.dart';

/// Result of a booking creation — includes the breakdown of costs.
class BookingResult {
  final BookingModel booking;
  final double servicePrice;
  final double bookingFee;
  final double commission;
  final double total;

  BookingResult({
    required this.booking,
    required this.servicePrice,
    required this.bookingFee,
    required this.commission,
    required this.total,
  });
}

class BookingService {
  final SupabaseClient _supabase = Supabase.instance.client;

  // ============================================
  // CREATE A BOOKING
  // ============================================
  // Called when a client taps "Book Now" or "Schedule".
  //
  // WHAT HAPPENS:
  // 1. Look up the service to get the price
  // 2. Calculate total (price + R10 fee + 10% commission)
  // 3. Create the booking record in the database
  // 4. Create a conversation (for in-app chat)
  // 5. The database will auto-create a notification for the pro
  //
  // The payment isn't captured yet — that happens when the job starts.
  // For now we just record the booking.

  Future<BookingResult?> createBooking({
    required String proId,
    required String serviceId,
    required String bookingType, // 'instant' or 'scheduled'
    required String serviceAddress,
    double? serviceLatitude,
    double? serviceLongitude,
    DateTime? scheduledStart, // Only for scheduled bookings
    String? clientNotes,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return null;

    try {
      // Step 1: Get the service details (to know the price)
      final serviceData = await _supabase
          .from('pro_services')
          .select()
          .eq('id', serviceId)
          .single();

      final servicePrice = double.parse(serviceData['price'].toString());

      // Step 2: Calculate costs
      const bookingFee = AppConstants.bookingFee;
      const commissionRate = AppConstants.commissionRate;
      final commission = servicePrice * (commissionRate / 100);
      final total = servicePrice + bookingFee + commission;

      // Step 3: Create the booking
      final bookingData = await _supabase
          .from('bookings')
          .insert({
            'client_id': userId,
            'pro_id': proId,
            'service_id': serviceId,
            'booking_type': bookingType,
            'status': 'pending',
            'service_address': serviceAddress,
            'service_latitude': serviceLatitude,
            'service_longitude': serviceLongitude,
            'scheduled_start': scheduledStart?.toIso8601String(),
            'service_price': servicePrice,
            'booking_fee': bookingFee,
            'commission_rate': commissionRate,
            'total_amount': total,
            'client_notes': clientNotes,
          })
          .select()
          .single();

      // Step 4: Create a conversation for this booking
      await _supabase.from('conversations').insert({
        'booking_id': bookingData['id'],
        'client_id': userId,
        'pro_id': proId,
      });

      return BookingResult(
        booking: BookingModel.fromJson(bookingData),
        servicePrice: servicePrice,
        bookingFee: bookingFee,
        commission: commission,
        total: total,
      );
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // PRO ACCEPTS A BOOKING
  // ============================================
  // Called when a pro taps "Accept" on a booking request.

  Future<bool> acceptBooking(String bookingId) async {
    try {
      await _supabase
          .from('bookings')
          .update({
            'status': 'accepted',
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', bookingId)
          .eq('pro_id', _supabase.auth.currentUser!.id);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // PRO DECLINES A BOOKING
  // ============================================

  Future<bool> declineBooking(String bookingId) async {
    try {
      await _supabase
          .from('bookings')
          .update({
            'status': 'cancelled',
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', bookingId)
          .eq('pro_id', _supabase.auth.currentUser!.id);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // START JOB
  // ============================================
  // Pro arrives and taps "Start Job".
  // Triggers: timer starts, emergency contact notified, payment captured.

  Future<bool> startJob(String bookingId) async {
    try {
      await _supabase
          .from('bookings')
          .update({
            'status': 'in_progress',
            'actual_start': DateTime.now().toIso8601String(),
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', bookingId)
          .eq('pro_id', _supabase.auth.currentUser!.id);

      // TODO: Send SMS to emergency contact via Twilio
      // TODO: Capture payment from escrow

      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // COMPLETE JOB
  // ============================================
  // Pro finishes and taps "Complete Job".
  // Triggers: payment released, vouch prompt shown to client.

  Future<bool> completeJob(String bookingId) async {
    try {
      // Get the booking to calculate duration
      final booking = await _supabase
          .from('bookings')
          .select('actual_start')
          .eq('id', bookingId)
          .single();

      final startTime = DateTime.parse(booking['actual_start']);
      final now = DateTime.now();
      final durationMinutes = now.difference(startTime).inMinutes;

      await _supabase
          .from('bookings')
          .update({
            'status': 'completed',
            'actual_end': now.toIso8601String(),
            'duration_minutes': durationMinutes,
            'updated_at': now.toIso8601String(),
          })
          .eq('id', bookingId)
          .eq('pro_id', _supabase.auth.currentUser!.id);

      // Set conversation to expire in 48 hours
      await _supabase
          .from('conversations')
          .update({
            'expires_at': now
                .add(const Duration(hours: AppConstants.chatExpiryHours))
                .toIso8601String(),
          })
          .eq('booking_id', bookingId);

      // TODO: Release payment from escrow to pro

      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // CREATE A VOUCH
  // ============================================
  // Client vouches for a pro after a completed job.
  // The database trigger automatically updates the pro's vouch stats.

  Future<bool> createVouch({
    required String bookingId,
    required String proId,
    String? vouchText,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _supabase.from('vouches').insert({
        'voucher_id': userId,
        'vouchee_id': proId,
        'booking_id': bookingId,
        'vouch_text': vouchText,
        'is_public': true,
      });
      return true;
    } catch (e) {
      return false; // Might be a duplicate vouch
    }
  }

  // ============================================
  // GET CLIENT'S BOOKINGS
  // ============================================
  // Used in the "Bookings" tab to show upcoming and past bookings.

  Future<List<BookingModel>> getClientBookings({
    String? statusFilter,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      var query = _supabase
          .from('bookings')
          .select()
          .eq('client_id', userId)
          .order('created_at', ascending: false);

      if (statusFilter != null) {
        query = query.eq('status', statusFilter);
      }

      final data = await query.limit(50);
      return (data as List<dynamic>)
          .map((json) => BookingModel.fromJson(json))
          .toList();
    } catch (e) {
      return [];
    }
  }

  // ============================================
  // GET PRO'S BOOKINGS
  // ============================================
  // Used in the pro's dashboard to see incoming requests and active jobs.

  Future<List<BookingModel>> getProBookings({
    String? statusFilter,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      var query = _supabase
          .from('bookings')
          .select()
          .eq('pro_id', userId)
          .order('created_at', ascending: false);

      if (statusFilter != null) {
        query = query.eq('status', statusFilter);
      }

      final data = await query.limit(50);
      return (data as List<dynamic>)
          .map((json) => BookingModel.fromJson(json))
          .toList();
    } catch (e) {
      return [];
    }
  }
}
