-- ============================================
-- VouchSA - Device Tokens for Push Notifications
-- ============================================
-- Stores Firebase Cloud Messaging (FCM) tokens for each user's device.
-- When we need to send a push notification, we look up the user's
-- token(s) here and send via Firebase.
--
-- A user can have multiple tokens (phone + tablet, for example).
-- ============================================

CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform VARCHAR(20) DEFAULT 'android',  -- 'android', 'ios', 'web'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each device token is unique per user
  CONSTRAINT unique_device_token UNIQUE (user_id, fcm_token)
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

-- RLS: Users can only manage their own tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens" ON device_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Send push notification
-- ============================================
-- Called by Edge Functions to send a push notification.
-- This stores the notification in the database AND triggers
-- the Edge Function to actually send it via FCM.
--
-- For now, notifications are stored in the notifications table
-- and the Edge Function handles FCM delivery.
-- ============================================

CREATE OR REPLACE FUNCTION create_and_notify(
  target_user_id UUID,
  notif_type VARCHAR,
  notif_title VARCHAR,
  notif_body TEXT,
  booking_id UUID DEFAULT NULL,
  action TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  -- Insert the notification record
  INSERT INTO notifications (
    user_id,
    notification_type,
    title,
    body,
    related_booking_id,
    action_url,
    is_read,
    is_pushed
  ) VALUES (
    target_user_id,
    notif_type,
    notif_title,
    notif_body,
    booking_id,
    action,
    FALSE,
    FALSE
  )
  RETURNING id INTO notif_id;

  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
