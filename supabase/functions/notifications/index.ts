// ============================================
// VouchSA - Push Notification Edge Function
// ============================================
//
// Sends push notifications via Firebase Cloud Messaging (FCM).
//
// HOW IT WORKS:
// 1. A booking event happens (new booking, accepted, completed, etc.)
// 2. The bookings Edge Function calls this function with the user ID and message
// 3. We look up the user's FCM token(s) from device_tokens table
// 4. We send the notification via Firebase's HTTP v1 API
//
// SETUP:
// You need to add your Firebase service account key as a Supabase secret:
// supabase secrets set FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, title, body, data } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and body are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up the user's FCM tokens
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from("device_tokens")
      .select("fcm_token")
      .eq("user_id", user_id);

    if (tokenError || !tokens || tokens.length === 0) {
      // No tokens found — user hasn't enabled notifications or isn't logged in
      // Store notification in DB anyway so they see it when they open the app
      return new Response(
        JSON.stringify({
          sent: false,
          reason: "No device tokens found for user",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Firebase access token using service account
    const firebaseKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!firebaseKey) {
      return new Response(
        JSON.stringify({
          sent: false,
          reason: "Firebase not configured (FIREBASE_SERVICE_ACCOUNT_KEY missing)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceAccount = JSON.parse(firebaseKey);
    const accessToken = await getFirebaseAccessToken(serviceAccount);

    // Send to each device token
    const results = await Promise.allSettled(
      tokens.map((t: { fcm_token: string }) =>
        sendFCMNotification(
          accessToken,
          serviceAccount.project_id,
          t.fcm_token,
          title,
          body,
          data || {}
        )
      )
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;

    // Mark notification as pushed in the database
    if (data?.notification_id) {
      await supabaseAdmin
        .from("notifications")
        .update({ is_pushed: true })
        .eq("id", data.notification_id);
    }

    return new Response(
      JSON.stringify({
        sent: true,
        devices_notified: sent,
        total_devices: tokens.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================
// Firebase Auth: Get access token from service account
// ============================================
async function getFirebaseAccessToken(
  serviceAccount: Record<string, string>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  // Sign the JWT with the service account's private key
  const encoder = new TextEncoder();
  const signingInput = encoder.encode(`${header}.${payload}`);

  const privateKey = serviceAccount.private_key;
  const pemContents = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signingInput
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  );
  const jwt = `${header}.${payload}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ============================================
// Send a single FCM notification
// ============================================
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<boolean> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: data,
          android: {
            priority: "high",
            notification: {
              channel_id: "vouchsa_notifications",
              sound: "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`FCM send failed: ${errorText}`);
    // If token is invalid, remove it from the database
    if (response.status === 404 || response.status === 410) {
      // Token expired or unregistered — clean it up
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseAdmin
        .from("device_tokens")
        .delete()
        .eq("fcm_token", fcmToken);
    }
    return false;
  }

  return true;
}
