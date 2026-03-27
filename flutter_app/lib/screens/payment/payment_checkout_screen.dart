// ============================================
// Payment Checkout Screen (Yoco WebView)
// ============================================
//
// WHAT IS THIS?
// When the client confirms a booking, we need to collect their
// card details. But we NEVER handle card numbers ourselves (too
// risky, too many regulations).
//
// Instead, we show Yoco's secure checkout page inside a WebView.
// A WebView is like a mini web browser inside your app.
//
// THE FLOW:
// 1. We create a checkout session via our Edge Function
// 2. Yoco gives us a URL (like https://pay.yoco.com/abc123)
// 3. We show that URL in a WebView
// 4. Client enters card details on Yoco's page
// 5. Yoco processes the payment
// 6. Yoco redirects to our success/failure URL
// 7. We detect the redirect and close the WebView
// 8. Back in the app, we show "Payment successful!" or error
//
// WHY WEBVIEW?
// Yoco doesn't have an official Flutter SDK (like Stripe does).
// The WebView approach is simpler and works with ANY payment
// provider. It's also the most secure — Yoco handles everything.
// ============================================

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../services/payment_service.dart';
import '../../utils/constants.dart';

/// The result of the payment process.
enum PaymentResult {
  success,
  failed,
  cancelled,
}

class PaymentCheckoutScreen extends StatefulWidget {
  final String bookingId;
  final double amount;
  final String serviceName;
  final String proName;

  const PaymentCheckoutScreen({
    super.key,
    required this.bookingId,
    required this.amount,
    required this.serviceName,
    required this.proName,
  });

  @override
  State<PaymentCheckoutScreen> createState() => _PaymentCheckoutScreenState();
}

class _PaymentCheckoutScreenState extends State<PaymentCheckoutScreen> {
  final PaymentService _paymentService = PaymentService();

  // State
  bool _isLoading = true;
  String? _errorMessage;
  String? _checkoutUrl;
  String? _checkoutId;

  // WebView controller
  late final WebViewController _webViewController;

  @override
  void initState() {
    super.initState();
    _initWebView();
    _createCheckout();
  }

  /// Set up the WebView controller.
  void _initWebView() {
    _webViewController = WebViewController()
      // Allow JavaScript (Yoco's page needs it)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // Listen for navigation changes (to detect success/failure redirects)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            // ============================================
            // DETECT PAYMENT RESULT
            // ============================================
            // After the client pays (or cancels), Yoco redirects to
            // a URL we specified when creating the checkout.
            // We check what URL we're being sent to:
            //
            // success URL → payment worked!
            // failure URL → card declined or error
            // cancel URL → client tapped "Cancel"

            if (url.contains('/payment/success')) {
              _handlePaymentResult(PaymentResult.success);
            } else if (url.contains('/payment/failed')) {
              _handlePaymentResult(PaymentResult.failed);
            } else if (url.contains('/payment/cancelled')) {
              _handlePaymentResult(PaymentResult.cancelled);
            }
          },
          onPageFinished: (_) {
            setState(() => _isLoading = false);
          },
          onWebResourceError: (error) {
            setState(() {
              _isLoading = false;
              _errorMessage = 'Could not load payment page. Please try again.';
            });
          },
        ),
      );
  }

  /// Create a Yoco checkout session via our Edge Function.
  Future<void> _createCheckout() async {
    final result = await _paymentService.createCheckout(
      bookingId: widget.bookingId,
      amount: widget.amount,
      description: '${widget.serviceName} with ${widget.proName}',
    );

    if (result != null) {
      setState(() {
        _checkoutUrl = result.redirectUrl;
        _checkoutId = result.checkoutId;
      });
      // Load the Yoco checkout page in the WebView
      _webViewController.loadRequest(Uri.parse(result.redirectUrl));
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Could not create payment session. Please try again.';
      });
    }
  }

  /// Handle the payment result (redirect from Yoco).
  void _handlePaymentResult(PaymentResult result) {
    // Pop this screen and return the result to the booking flow
    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            // Confirm they want to cancel payment
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Cancel Payment?'),
                content: const Text(
                  'Your booking will not be confirmed without payment.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Continue Paying'),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context); // Close dialog
                      Navigator.pop(
                          context, PaymentResult.cancelled); // Close checkout
                    },
                    child: const Text('Cancel',
                        style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      body: _errorMessage != null
          ? _buildError()
          : Stack(
              children: [
                // The WebView showing Yoco's checkout page
                if (_checkoutUrl != null)
                  WebViewWidget(controller: _webViewController),

                // Loading indicator
                if (_isLoading)
                  Container(
                    color: Colors.white,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const CircularProgressIndicator(),
                          const SizedBox(height: 24),
                          const Text(
                            'Loading secure payment...',
                            style: TextStyle(fontSize: 16),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'R${widget.amount.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.serviceName,
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Security badge at the bottom
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    color: Colors.grey[100],
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 6),
                        Text(
                          'Secured by Yoco · Your card details are never stored in VouchSA',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _isLoading = true;
                  _errorMessage = null;
                });
                _createCheckout();
              },
              child: const Text('Try Again'),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () =>
                  Navigator.pop(context, PaymentResult.failed),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}
