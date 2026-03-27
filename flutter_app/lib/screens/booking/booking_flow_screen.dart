// ============================================
// Booking Flow Screen
// ============================================
//
// WHAT IS THIS?
// A multi-step screen that guides the client through booking a pro.
// It's like a checkout process on an online store:
//
// Step 1: SELECT SERVICE — Pick what you need (e.g., "Men's Haircut")
// Step 2: CONFIRM LOCATION — Where should the pro come?
// Step 3: ADD NOTES — Any special requests?
// Step 4: REVIEW & CONFIRM — See the price breakdown and confirm
//
// WHAT IS A STEPPER?
// Think of it like filling out a multi-page form. Each "step" is one
// page. You can go forward and backward. The stepper shows progress
// at the top (Step 1 of 4, Step 2 of 4, etc).
//
// HOW IT CONNECTS:
// When the user confirms, BookingService.createBooking() is called.
// This creates the booking in Supabase and notifies the pro.
// ============================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/booking_model.dart';
import '../../providers/location_provider.dart';
import '../../services/booking_service.dart';
import '../../services/payment_service.dart';
import '../../services/pro_service.dart';
import '../../utils/constants.dart';
import '../payment/payment_checkout_screen.dart';

class BookingFlowScreen extends StatefulWidget {
  /// The pro being booked
  final String proUserId;
  final String proName;

  /// Their services (fetched on the previous screen)
  final List<ProServiceModel> services;

  /// Is this an instant booking ("Book Now") or scheduled?
  final String bookingType; // 'instant' or 'scheduled'

  const BookingFlowScreen({
    super.key,
    required this.proUserId,
    required this.proName,
    required this.services,
    this.bookingType = 'instant',
  });

  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  final BookingService _bookingService = BookingService();

  // ============================================
  // STATE — tracks what the user has selected
  // ============================================
  int _currentStep = 0; // Which step we're on (0-3)
  ProServiceModel? _selectedService; // The service they picked
  String _address = ''; // Where the pro should come
  final _addressController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime? _scheduledDate; // Only for scheduled bookings
  TimeOfDay? _scheduledTime;
  bool _isSubmitting = false;
  bool _useCurrentLocation = true; // Default: use GPS location

  @override
  void dispose() {
    _addressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Book ${widget.proName}'),
      ),
      body: Stepper(
        // Which step is currently active
        currentStep: _currentStep,

        // What type of stepper: vertical (stacked) not horizontal
        type: StepperType.vertical,

        // ============================================
        // NAVIGATION: What happens when user taps Continue/Cancel
        // ============================================
        onStepContinue: () {
          // Validate current step before moving forward
          if (_validateCurrentStep()) {
            if (_currentStep < 3) {
              setState(() => _currentStep++);
            } else {
              // Last step — submit the booking!
              _submitBooking();
            }
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep--);
          } else {
            Navigator.of(context).pop(); // Go back to previous screen
          }
        },
        onStepTapped: (step) {
          // Only allow tapping to go BACK, not forward (must validate)
          if (step < _currentStep) {
            setState(() => _currentStep = step);
          }
        },

        // ============================================
        // CUSTOM BUTTON BUILDER
        // ============================================
        // Makes the Continue/Cancel buttons look nicer
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                // Continue / Submit button
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : details.onStepContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _currentStep == 3
                          ? AppConstants.primaryColor
                          : null,
                      foregroundColor:
                          _currentStep == 3 ? Colors.white : null,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(_currentStep == 3 ? 'Confirm Booking' : 'Next'),
                  ),
                ),
                const SizedBox(width: 12),
                // Back button
                if (_currentStep > 0)
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
              ],
            ),
          );
        },

        // ============================================
        // THE 4 STEPS
        // ============================================
        steps: [
          // ============================================
          // STEP 1: SELECT SERVICE
          // ============================================
          Step(
            title: const Text('Select Service'),
            subtitle: _selectedService != null
                ? Text(
                    '${_selectedService!.serviceName} — R${_selectedService!.price.toStringAsFixed(0)}')
                : null,
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
            content: Column(
              children: [
                const Text(
                  'What service do you need?',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 12),
                // List of services as selectable cards
                ...widget.services.map((service) => _ServiceCard(
                      service: service,
                      isSelected: _selectedService?.id == service.id,
                      onTap: () {
                        setState(() => _selectedService = service);
                      },
                    )),
              ],
            ),
          ),

          // ============================================
          // STEP 2: CONFIRM LOCATION
          // ============================================
          Step(
            title: const Text('Service Location'),
            subtitle: _address.isNotEmpty ? Text(_address) : null,
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : StepState.indexed,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Where should the pro come?',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 12),

                // Option 1: Use current GPS location
                RadioListTile<bool>(
                  title: const Text('Use my current location'),
                  subtitle: const Text('Pro will come to where you are now'),
                  value: true,
                  groupValue: _useCurrentLocation,
                  onChanged: (val) =>
                      setState(() => _useCurrentLocation = val!),
                ),

                // Option 2: Enter a different address
                RadioListTile<bool>(
                  title: const Text('Enter a different address'),
                  value: false,
                  groupValue: _useCurrentLocation,
                  onChanged: (val) =>
                      setState(() => _useCurrentLocation = val!),
                ),

                // Address input (only shown if not using current location)
                if (!_useCurrentLocation) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _addressController,
                    decoration: const InputDecoration(
                      labelText: 'Address',
                      hintText: '123 Main Street, Randburg',
                      prefixIcon: Icon(Icons.location_on_outlined),
                    ),
                    onChanged: (val) => _address = val,
                  ),
                ],

                // Scheduled booking: date & time picker
                if (widget.bookingType == 'scheduled') ...[
                  const SizedBox(height: 20),
                  const Divider(),
                  const SizedBox(height: 12),
                  const Text(
                    'When do you need this?',
                    style: TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pickDate(context),
                          icon: const Icon(Icons.calendar_today, size: 18),
                          label: Text(
                            _scheduledDate != null
                                ? '${_scheduledDate!.day}/${_scheduledDate!.month}/${_scheduledDate!.year}'
                                : 'Pick Date',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pickTime(context),
                          icon: const Icon(Icons.access_time, size: 18),
                          label: Text(
                            _scheduledTime != null
                                ? _scheduledTime!.format(context)
                                : 'Pick Time',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // ============================================
          // STEP 3: SPECIAL REQUESTS
          // ============================================
          Step(
            title: const Text('Special Requests'),
            subtitle: const Text('Optional'),
            isActive: _currentStep >= 2,
            state: _currentStep > 2 ? StepState.complete : StepState.indexed,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Anything the pro should know?',
                  style: TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText:
                        'e.g., "I have a big dog but he\'s friendly", "Please bring your own extension cord"',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),

          // ============================================
          // STEP 4: REVIEW & CONFIRM
          // ============================================
          Step(
            title: const Text('Review & Confirm'),
            isActive: _currentStep >= 3,
            state: _currentStep > 3 ? StepState.complete : StepState.indexed,
            content: _selectedService != null
                ? _buildReviewStep()
                : const Text('Please select a service first.'),
          ),
        ],
      ),
    );
  }

  // ============================================
  // REVIEW STEP — Shows the full price breakdown
  // ============================================
  Widget _buildReviewStep() {
    final service = _selectedService!;
    final commission = service.price * (AppConstants.commissionRate / 100);
    final total = service.price + AppConstants.bookingFee + commission;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Pro name
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(
            child: Icon(Icons.person),
          ),
          title: Text(
            widget.proName,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          subtitle: Text(widget.bookingType == 'instant'
              ? 'Instant Booking'
              : 'Scheduled Booking'),
        ),
        const Divider(),

        // Service
        _buildReviewRow('Service', service.serviceName),
        _buildReviewRow('Duration', '${service.durationMinutes} minutes'),

        if (widget.bookingType == 'scheduled' && _scheduledDate != null)
          _buildReviewRow(
            'When',
            '${_scheduledDate!.day}/${_scheduledDate!.month}/${_scheduledDate!.year}'
            ' at ${_scheduledTime?.format(context) ?? "TBD"}',
          ),

        _buildReviewRow(
          'Location',
          _useCurrentLocation ? 'Your current location' : _address,
        ),

        if (_notesController.text.isNotEmpty)
          _buildReviewRow('Notes', _notesController.text),

        const Divider(),
        const SizedBox(height: 8),

        // ============================================
        // PRICE BREAKDOWN
        // ============================================
        const Text(
          'Price Breakdown',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        _buildPriceRow('Service fee', 'R${service.price.toStringAsFixed(2)}'),
        _buildPriceRow(
          'Booking fee',
          'R${AppConstants.bookingFee.toStringAsFixed(2)}',
        ),
        _buildPriceRow(
          'Platform fee (${AppConstants.commissionRate.toStringAsFixed(0)}%)',
          'R${commission.toStringAsFixed(2)}',
        ),
        const Divider(),
        _buildPriceRow(
          'Total',
          'R${total.toStringAsFixed(2)}',
          isBold: true,
        ),

        const SizedBox(height: 12),

        // Payment info
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.blue.withOpacity(0.05),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.blue.withOpacity(0.2)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Payment is held in escrow and only released to the pro after the job is completed.',
                  style: TextStyle(fontSize: 12, color: Colors.blue),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// A row in the review section (label: value).
  Widget _buildReviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  /// A row in the price breakdown.
  Widget _buildPriceRow(String label, String amount, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isBold ? 16 : 14,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            amount,
            style: TextStyle(
              fontSize: isBold ? 16 : 14,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  // ============================================
  // VALIDATION — Checks each step before proceeding
  // ============================================

  bool _validateCurrentStep() {
    switch (_currentStep) {
      case 0: // Must select a service
        if (_selectedService == null) {
          _showError('Please select a service');
          return false;
        }
        return true;

      case 1: // Must have a location
        if (_useCurrentLocation) {
          final location = context.read<LocationProvider>();
          if (location.currentPosition == null) {
            _showError('Could not get your location. Please enter an address.');
            return false;
          }
          _address = 'Current location';
        } else if (_addressController.text.trim().isEmpty) {
          _showError('Please enter an address');
          return false;
        } else {
          _address = _addressController.text.trim();
        }
        // For scheduled bookings, need a date
        if (widget.bookingType == 'scheduled' && _scheduledDate == null) {
          _showError('Please pick a date and time');
          return false;
        }
        return true;

      case 2: // Notes are optional, always valid
        return true;

      case 3: // Review step — always valid (just confirmation)
        return true;

      default:
        return true;
    }
  }

  // ============================================
  // SUBMIT THE BOOKING (with Payment)
  // ============================================
  // Called when user taps "Confirm Booking" on the last step.
  //
  // FLOW:
  // 1. Open Yoco checkout (client enters card details)
  // 2. If payment succeeds → create the booking in database
  // 3. Show confirmation screen
  //
  // WHY PAYMENT FIRST?
  // We want to make sure the client can pay before creating
  // the booking. Otherwise, the pro gets a notification for a
  // booking that has no payment behind it.

  Future<void> _submitBooking() async {
    setState(() => _isSubmitting = true);

    final location = context.read<LocationProvider>();
    final service = _selectedService!;
    final commission = service.price * (AppConstants.commissionRate / 100);
    final total = service.price + AppConstants.bookingFee + commission;

    // ============================================
    // STEP 1: Open Yoco Payment Checkout
    // ============================================
    final paymentResult = await Navigator.of(context).push<PaymentResult>(
      MaterialPageRoute(
        builder: (_) => PaymentCheckoutScreen(
          bookingId: '', // We'll create the booking after payment
          amount: total,
          serviceName: service.serviceName,
          proName: widget.proName,
        ),
      ),
    );

    // Check if payment was successful
    if (paymentResult != PaymentResult.success) {
      setState(() => _isSubmitting = false);
      if (!mounted) return;

      if (paymentResult == PaymentResult.failed) {
        _showError('Payment failed. Please try again or use a different card.');
      }
      // If cancelled, just return to the review step silently
      return;
    }

    // ============================================
    // STEP 2: Create the Booking (payment succeeded)
    // ============================================
    // Build the scheduled start time (if scheduled booking)
    DateTime? scheduledStart;
    if (widget.bookingType == 'scheduled' &&
        _scheduledDate != null &&
        _scheduledTime != null) {
      scheduledStart = DateTime(
        _scheduledDate!.year,
        _scheduledDate!.month,
        _scheduledDate!.day,
        _scheduledTime!.hour,
        _scheduledTime!.minute,
      );
    }

    final result = await _bookingService.createBooking(
      proId: widget.proUserId,
      serviceId: service.id,
      bookingType: widget.bookingType,
      serviceAddress: _useCurrentLocation ? 'Client\'s current location' : _address,
      serviceLatitude: _useCurrentLocation ? location.latitude : null,
      serviceLongitude: _useCurrentLocation ? location.longitude : null,
      scheduledStart: scheduledStart,
      clientNotes: _notesController.text.isNotEmpty
          ? _notesController.text
          : null,
    );

    setState(() => _isSubmitting = false);

    if (!mounted) return;

    if (result != null) {
      // ============================================
      // STEP 3: Show Confirmation
      // ============================================
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => BookingConfirmationScreen(
            booking: result.booking,
            proName: widget.proName,
            serviceName: _selectedService!.serviceName,
            total: result.total,
          ),
        ),
      );
    } else {
      _showError('Failed to create booking. Please try again.');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  Future<void> _pickDate(BuildContext context) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (date != null) {
      setState(() => _scheduledDate = date);
    }
  }

  Future<void> _pickTime(BuildContext context) async {
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 9, minute: 0),
    );
    if (time != null) {
      setState(() => _scheduledTime = time);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }
}

// ============================================
// Service Selection Card (used in Step 1)
// ============================================

class _ServiceCard extends StatelessWidget {
  final ProServiceModel service;
  final bool isSelected;
  final VoidCallback onTap;

  const _ServiceCard({
    required this.service,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(
            color: isSelected ? AppConstants.primaryColor : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: isSelected
              ? AppConstants.primaryColor.withOpacity(0.05)
              : Colors.white,
        ),
        child: Row(
          children: [
            // Selection indicator
            Icon(
              isSelected
                  ? Icons.check_circle
                  : Icons.radio_button_unchecked,
              color: isSelected ? AppConstants.primaryColor : Colors.grey,
            ),
            const SizedBox(width: 12),

            // Service details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    service.serviceName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (service.description != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      service.description!,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    '${service.durationMinutes} min',
                    style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                  ),
                ],
              ),
            ),

            // Price
            Text(
              'R${service.price.toStringAsFixed(0)}',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? AppConstants.primaryColor
                    : Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================
// Booking Confirmation Screen
// ============================================
// Shown after a successful booking. Displays a success message
// and what to expect next.

class BookingConfirmationScreen extends StatelessWidget {
  final BookingModel booking;
  final String proName;
  final String serviceName;
  final double total;

  const BookingConfirmationScreen({
    super.key,
    required this.booking,
    required this.proName,
    required this.serviceName,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final isInstant = booking.bookingType == 'instant';

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Success icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: AppConstants.primaryColor.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle,
                  size: 60,
                  color: AppConstants.primaryColor,
                ),
              ),
              const SizedBox(height: 24),

              // Title
              const Text(
                'Booking Sent!',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              // Subtitle
              Text(
                isInstant
                    ? '$proName has 2 minutes to accept your booking.'
                    : 'Your booking request has been sent to $proName.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.grey[600]),
              ),
              const SizedBox(height: 32),

              // Booking summary card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[200]!),
                ),
                child: Column(
                  children: [
                    _SummaryRow(
                        label: 'Service', value: serviceName),
                    const SizedBox(height: 8),
                    _SummaryRow(label: 'Pro', value: proName),
                    const SizedBox(height: 8),
                    _SummaryRow(
                      label: 'Type',
                      value: isInstant ? 'Instant' : 'Scheduled',
                    ),
                    const Divider(height: 20),
                    _SummaryRow(
                      label: 'Total',
                      value: 'R${total.toStringAsFixed(2)}',
                      isBold: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // What happens next
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'What happens next?',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    _NextStepRow('1', isInstant
                        ? '$proName accepts (within 2 min)'
                        : '$proName reviews your request'),
                    _NextStepRow('2', 'You\'ll get a notification'),
                    _NextStepRow('3', 'Chat opens so you can coordinate'),
                    _NextStepRow('4', 'Pro arrives and starts the job'),
                  ],
                ),
              ),

              const Spacer(),

              // Done button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    // Go back to the map (home screen)
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text(
                    'Back to Map',
                    style: TextStyle(fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isBold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey[600])),
        Text(
          value,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            fontSize: isBold ? 16 : 14,
          ),
        ),
      ],
    );
  }
}

class _NextStepRow extends StatelessWidget {
  final String number;
  final String text;

  const _NextStepRow(this.number, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          CircleAvatar(
            radius: 10,
            backgroundColor: Colors.amber,
            child: Text(number,
                style: const TextStyle(fontSize: 10, color: Colors.white)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
