// ============================================
// VouchSA - Booking Edge Functions
// ============================================
//
// Handles the entire booking lifecycle:
// 1. Client creates a booking (instant or scheduled)
// 2. Pro accepts or declines
// 3. Pro starts the job
// 4. Pro completes the job (triggers payment + vouch prompt)
// 5. Client can dispute if something went wrong
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Use a service role client for operations that need elevated permissions
    // (like creating notifications for other users)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);
    const action = path[1] || "";
    const bookingId = path[1];
    const subAction = path[2] || ""; // e.g., "accept", "start", "complete"

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // POST /bookings - Create a new booking
    // ============================================
    // Client sends: service_id, booking_type, service_address, etc.
    // We calculate the total, create the booking, and notify the pro.
    if (req.method === "POST" && !action) {
      const body = await req.json();
      const {
        pro_id,
        service_id,
        booking_type, // 'instant' or 'scheduled'
        service_address,
        service_latitude,
        service_longitude,
        scheduled_start, // Only for scheduled bookings
        client_notes,
      } = body;

      // Look up the service to get the price
      const { data: service, error: serviceError } = await supabaseClient
        .from("pro_services")
        .select("*")
        .eq("id", service_id)
        .single();

      if (serviceError || !service) {
        return new Response(
          JSON.stringify({ error: "Service not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Calculate the total cost
      const bookingFee = 10.0; // R10 flat fee
      const commissionRate = 10.0; // 10%
      const commission = service.price * (commissionRate / 100);
      const totalAmount = service.price + bookingFee + commission;

      // Create the booking record
      const { data: booking, error: bookingError } = await supabaseClient
        .from("bookings")
        .insert({
          client_id: user.id,
          pro_id,
          service_id,
          booking_type,
          status: "pending",
          service_address,
          service_latitude,
          service_longitude,
          scheduled_start: scheduled_start || null,
          service_price: service.price,
          booking_fee: bookingFee,
          commission_rate: commissionRate,
          total_amount: totalAmount,
          client_notes,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Notify the pro about the new booking request
      await supabaseAdmin.from("notifications").insert({
        user_id: pro_id,
        notification_type: "new_booking",
        title: "New Booking Request!",
        body: `${booking_type === "instant" ? "Someone wants to book you NOW" : "Someone wants to schedule a booking"}. Tap to review.`,
        related_booking_id: booking.id,
        action_url: `/bookings/${booking.id}`,
      });

      // Create a conversation for this booking (so they can chat)
      await supabaseClient.from("conversations").insert({
        booking_id: booking.id,
        client_id: user.id,
        pro_id,
      });

      return new Response(
        JSON.stringify({
          booking,
          total_breakdown: {
            service_price: service.price,
            booking_fee: bookingFee,
            commission,
            total: totalAmount,
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // PUT /bookings/:id/accept - Pro accepts a booking
    // ============================================
    if (req.method === "PUT" && bookingId && subAction === "accept") {
      // Verify this pro owns this booking
      const { data: booking, error } = await supabaseClient
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("pro_id", user.id)
        .eq("status", "pending")
        .single();

      if (error || !booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found or already processed" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update status to accepted
      const { error: updateError } = await supabaseClient
        .from("bookings")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      // Notify the client
      await supabaseAdmin.from("notifications").insert({
        user_id: booking.client_id,
        notification_type: "booking_accepted",
        title: "Booking Accepted!",
        body:
          booking.booking_type === "instant"
            ? "Your pro is on the way!"
            : "Your booking has been confirmed.",
        related_booking_id: bookingId,
        action_url: `/bookings/${bookingId}`,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Booking accepted" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // PUT /bookings/:id/start - Pro starts the job
    // ============================================
    // Live tracking begins
    if (req.method === "PUT" && bookingId && subAction === "start") {
      const { data: booking, error } = await supabaseClient
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("pro_id", user.id)
        .eq("status", "accepted")
        .single();

      if (error || !booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found or not in accepted state" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update booking to in_progress
      const { error: updateError } = await supabaseClient
        .from("bookings")
        .update({
          status: "in_progress",
          actual_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      // Notify client that job has started
      await supabaseAdmin.from("notifications").insert({
        user_id: booking.client_id,
        notification_type: "job_started",
        title: "Job Started",
        body: "Your pro has arrived and started the service.",
        related_booking_id: bookingId,
        action_url: `/bookings/${bookingId}/track`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Job started. Client has been notified.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // PUT /bookings/:id/complete - Pro completes the job
    // ============================================
    // Triggers: payment release, vouch prompt, stat updates
    if (req.method === "PUT" && bookingId && subAction === "complete") {
      const { data: booking, error } = await supabaseClient
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("pro_id", user.id)
        .eq("status", "in_progress")
        .single();

      if (error || !booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found or not in progress" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const now = new Date();
      const startTime = new Date(booking.actual_start);
      const durationMinutes = Math.round(
        (now.getTime() - startTime.getTime()) / 60000
      );

      // Update booking to completed
      const { error: updateError } = await supabaseClient
        .from("bookings")
        .update({
          status: "completed",
          actual_end: now.toISOString(),
          duration_minutes: durationMinutes,
          updated_at: now.toISOString(),
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      // Set conversation to expire in 48 hours
      await supabaseClient
        .from("conversations")
        .update({
          expires_at: new Date(
            now.getTime() + 48 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq("booking_id", bookingId);

      // Notify client: job done + vouch prompt
      await supabaseAdmin.from("notifications").insert({
        user_id: booking.client_id,
        notification_type: "job_completed",
        title: "Job Completed!",
        body: "How was the service? Tap to vouch for your pro.",
        related_booking_id: bookingId,
        action_url: `/bookings/${bookingId}/vouch`,
      });

      // Trigger automated payment capture and pro payout
      try {
        const paymentsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payments`;
        await fetch(paymentsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            action: "capture_and_payout",
            booking_id: bookingId,
          }),
        });
      } catch (_captureError) {
        // Payment capture failed — admin can trigger manually
        console.error("Auto-capture failed for booking:", bookingId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          duration_minutes: durationMinutes,
          message: "Job completed. Payment will be processed.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // POST /bookings/:id/dispute - Client reports an issue
    // ============================================
    if (req.method === "POST" && bookingId && subAction === "dispute") {
      const { description, report_type } = await req.json();

      // Update booking status
      await supabaseClient
        .from("bookings")
        .update({
          status: "disputed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      // Create a report for admin review
      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .insert({
          reporter_id: user.id,
          reported_user_id: null, // Admin will determine
          booking_id: bookingId,
          report_type: report_type || "general",
          description,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          report_id: report.id,
          message:
            "Your report has been submitted. Payment is held until resolved.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
