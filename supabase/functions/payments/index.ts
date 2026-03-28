// ============================================
// VouchSA - Payment Edge Function (Yoco Integration)
// ============================================
//
// WHY IS THIS AN EDGE FUNCTION AND NOT IN THE APP?
// The Yoco SECRET key must NEVER be in the app code.
// If someone decompiled your app (which is easy), they could
// steal the key and charge people's cards. Edge Functions run
// on Supabase's servers where the key is safe.
//
// WHAT DOES THIS FUNCTION HANDLE?
// 1. create_checkout — Creates a Yoco checkout session
// 2. verify_payment — Checks if a payment was successful
// 3. webhook — Receives notifications from Yoco when payments complete
//
// YOCO API DOCS: https://developer.yoco.com/
//
// SETUP STEPS:
// 1. Sign up at yoco.com
// 2. Go to your Yoco dashboard → Developers → API Keys
// 3. Copy your Secret Key (starts with sk_live_ or sk_test_)
// 4. In Supabase dashboard → Edge Functions → Secrets
// 5. Add: YOCO_SECRET_KEY = sk_test_your_key_here
// 6. Add: YOCO_WEBHOOK_SECRET = your_webhook_secret_here
//
// IMPORTANT: Use sk_test_ keys during development!
// Switch to sk_live_ keys only when going to production.
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Yoco API base URL
const YOCO_API_URL = "https://payments.yoco.com/api";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    // Get the Yoco secret key from environment variables
    // (set in Supabase dashboard → Edge Functions → Secrets)
    const yocoSecretKey = Deno.env.get("YOCO_SECRET_KEY");
    if (!yocoSecretKey) {
      throw new Error("YOCO_SECRET_KEY not configured. Set it in Supabase Edge Function secrets.");
    }

    // Create Supabase clients
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ============================================
    // ACTION: CREATE CHECKOUT
    // ============================================
    // Creates a Yoco checkout session.
    //
    // Yoco's checkout flow:
    // 1. We send: amount, currency, description
    // 2. Yoco returns: a checkout ID and redirect URL
    // 3. We show the redirect URL in a WebView
    // 4. Client enters card details on Yoco's page
    // 5. Yoco charges the card
    // 6. Yoco sends us a webhook (or we poll for status)

    if (action === "create_checkout") {
      const { booking_id, amount, description, currency } = body;

      // Convert Rands to cents (Yoco expects cents)
      // R150.00 → 15000 cents
      const amountInCents = Math.round(amount * 100);

      // Call Yoco's API to create a checkout
      const yocoResponse = await fetch(`${YOCO_API_URL}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${yocoSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: currency || "ZAR",
          // Where Yoco redirects after payment
          successUrl: `https://vouchsa.co.za/payment/success?booking_id=${booking_id}`,
          cancelUrl: `https://vouchsa.co.za/payment/cancelled?booking_id=${booking_id}`,
          failureUrl: `https://vouchsa.co.za/payment/failed?booking_id=${booking_id}`,
          metadata: {
            booking_id: booking_id,
            description: description,
          },
        }),
      });

      if (!yocoResponse.ok) {
        const errorBody = await yocoResponse.text();
        throw new Error(`Yoco API error: ${yocoResponse.status} - ${errorBody}`);
      }

      const yocoData = await yocoResponse.json();

      // Save the transaction in our database
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("transactions")
        .insert({
          booking_id: booking_id,
          transaction_type: "authorization",
          amount: amount,
          status: "pending",
          payment_provider: "yoco",
          payment_provider_ref: yocoData.id, // Yoco's checkout ID
        })
        .select()
        .single();

      if (txError) throw txError;

      return new Response(
        JSON.stringify({
          checkout_id: yocoData.id,
          redirect_url: yocoData.redirectUrl,
          transaction_id: transaction.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // ACTION: VERIFY PAYMENT
    // ============================================
    // After the client completes checkout, we verify the payment
    // actually went through by checking with Yoco.

    if (action === "verify_payment") {
      const { booking_id, checkout_id } = body;

      // Check with Yoco if the payment was successful
      const yocoResponse = await fetch(
        `${YOCO_API_URL}/checkouts/${checkout_id}`,
        {
          headers: {
            Authorization: `Bearer ${yocoSecretKey}`,
          },
        }
      );

      if (!yocoResponse.ok) {
        throw new Error("Could not verify payment with Yoco");
      }

      const yocoData = await yocoResponse.json();
      const paymentStatus = yocoData.status; // 'completed', 'failed', etc.

      if (paymentStatus === "completed") {
        // Payment successful! Update our transaction record.
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("payment_provider_ref", checkout_id);

        // Calculate pro payout (90%) and commission (10%)
        const booking = await supabaseAdmin
          .from("bookings")
          .select("service_price, commission_rate")
          .eq("id", booking_id)
          .single();

        if (booking.data) {
          const servicePrice = booking.data.service_price;
          const commissionRate = booking.data.commission_rate;
          const commission = servicePrice * (commissionRate / 100);
          const proPayout = servicePrice;

          await supabaseAdmin
            .from("transactions")
            .update({
              pro_payout_amount: proPayout,
              commission_amount: commission,
            })
            .eq("payment_provider_ref", checkout_id);
        }

        return new Response(
          JSON.stringify({ status: "successful", checkout_id }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Payment failed
        await supabaseAdmin
          .from("transactions")
          .update({ status: "failed" })
          .eq("payment_provider_ref", checkout_id);

        return new Response(
          JSON.stringify({ status: "failed", reason: yocoData.status }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ============================================
    // ACTION: PROCESS PAYOUT
    // ============================================
    // Sends money from VouchSA's Yoco account to the pro's bank.
    //
    // NOTE: Yoco's payout API may not support direct bank transfers
    // in all cases. In the early days, you might process payouts
    // manually from your Yoco dashboard or via EFT from your
    // business bank account. This endpoint records the intent.

    if (action === "process_payout") {
      const { payout_id } = body;

      // Get the payout details with pro's bank info
      const { data: payout, error } = await supabaseAdmin
        .from("pro_payouts")
        .select("*, pro:pro_id(phone_number), pro_profile:pro_id(bank_name, bank_account_number, bank_branch_code)")
        .eq("id", payout_id)
        .eq("status", "pending")
        .single();

      if (error || !payout) {
        return new Response(
          JSON.stringify({ error: "Payout not found or already processed" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Mark as processing
      await supabaseAdmin
        .from("pro_payouts")
        .update({ status: "processing" })
        .eq("id", payout_id);

      // Attempt automated payout via Yoco's Transfer API
      let payoutSuccessful = false;
      try {
        const yocoResponse = await fetch(`${YOCO_API_URL}/transfers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${yocoSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(payout.amount * 100), // cents
            currency: "ZAR",
            bankAccount: {
              bankName: payout.pro_profile?.bank_name,
              accountNumber: payout.pro_profile?.bank_account_number,
              branchCode: payout.pro_profile?.bank_branch_code,
            },
            reference: `VOUCHSA-${payout_id.substring(0, 8)}`,
          }),
        });

        if (yocoResponse.ok) {
          const transferData = await yocoResponse.json();
          await supabaseAdmin
            .from("pro_payouts")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              payment_reference: transferData.id || `yoco-${payout_id}`,
            })
            .eq("id", payout_id);
          payoutSuccessful = true;
        }
      } catch (_transferError) {
        // Yoco Transfer API may not be available — fall back to manual
      }

      // If automated payout failed, keep as "processing" for manual handling
      if (!payoutSuccessful) {
        // Store details for manual EFT processing
        await supabaseAdmin
          .from("pro_payouts")
          .update({
            payment_reference: `MANUAL-${payout_id.substring(0, 8)}`,
          })
          .eq("id", payout_id);
      }

      // Notify the pro about their payout status
      await supabaseAdmin.from("notifications").insert({
        user_id: payout.pro_id,
        notification_type: "payout_processing",
        title: payoutSuccessful ? "Payout Sent!" : "Payout Processing",
        body: payoutSuccessful
          ? `R${payout.amount.toFixed(2)} has been sent to your bank account.`
          : `Your R${payout.amount.toFixed(2)} payout is being processed. You'll receive it within 24 hours.`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          payout_id,
          automated: payoutSuccessful,
          message: payoutSuccessful
            ? "Payout sent to bank account."
            : "Payout queued for manual processing within 24 hours.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // ACTION: AUTO CAPTURE (Called when job completes)
    // ============================================
    // Automatically captures the escrowed payment and creates
    // a payout record for the pro.

    if (action === "capture_and_payout") {
      const { booking_id } = body;

      // Get booking with payment details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("*, transaction:transactions!inner(id, payment_provider_ref, amount)")
        .eq("id", booking_id)
        .eq("status", "completed")
        .single();

      if (bookingError || !booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found or not completed" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create capture transaction
      const servicePrice = booking.service_price;
      const commissionRate = booking.commission_rate || 10;
      const commission = servicePrice * (commissionRate / 100);
      const proPayout = servicePrice; // Pro gets full service price

      await supabaseAdmin.from("transactions").insert({
        booking_id: booking_id,
        transaction_type: "capture",
        amount: booking.total_amount,
        status: "completed",
        payment_provider: "yoco",
        pro_payout_amount: proPayout,
        commission_amount: commission,
        completed_at: new Date().toISOString(),
      });

      // Create automatic payout record for the pro
      const { data: payoutRecord } = await supabaseAdmin
        .from("pro_payouts")
        .insert({
          pro_id: booking.pro_id,
          amount: proPayout,
          status: "pending",
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          captured: booking.total_amount,
          pro_payout: proPayout,
          commission: commission,
          payout_id: payoutRecord?.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // WEBHOOK: Yoco Payment Notifications
    // ============================================
    // Yoco sends POST requests to this endpoint when payments
    // are completed, refunded, etc. This is more reliable than
    // polling because Yoco tells US when something happens.
    //
    // SETUP:
    // 1. In Yoco dashboard → Developers → Webhooks
    // 2. Add URL: https://your-project.supabase.co/functions/v1/payments
    // 3. Set the body to include: action: "webhook"

    if (action === "webhook") {
      const { type, data } = body;

      if (type === "payment.succeeded") {
        const checkoutId = data.metadata?.checkout_id || data.id;

        // Update transaction status
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("payment_provider_ref", checkoutId);
      }

      if (type === "payment.failed") {
        const checkoutId = data.metadata?.checkout_id || data.id;

        await supabaseAdmin
          .from("transactions")
          .update({ status: "failed" })
          .eq("payment_provider_ref", checkoutId);
      }

      // Always return 200 to Yoco so they know we received it
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
