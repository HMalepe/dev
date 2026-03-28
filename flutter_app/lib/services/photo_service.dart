// ============================================
// Photo Service - Profile Photo Upload
// ============================================
//
// Handles picking photos from camera or gallery and
// uploading them to Supabase Storage.
//
// FLOW:
// 1. User taps their profile photo
// 2. They choose: Camera or Gallery
// 3. The image is compressed and uploaded to Supabase Storage
// 4. The public URL is saved to their profile
// ============================================

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PhotoService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final ImagePicker _picker = ImagePicker();

  /// Shows a bottom sheet letting the user choose Camera or Gallery,
  /// then picks the image, uploads it, and returns the public URL.
  ///
  /// Returns null if the user cancelled or upload failed.
  Future<String?> pickAndUploadProfilePhoto(BuildContext context) async {
    // Show bottom sheet to choose camera or gallery
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Choose Photo',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Colors.blue),
                title: const Text('Take a Photo'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Colors.green),
                title: const Text('Choose from Gallery'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return null;

    // Pick the image
    final XFile? image = await _picker.pickImage(
      source: source,
      maxWidth: 800,   // Compress to max 800px wide
      maxHeight: 800,  // Compress to max 800px tall
      imageQuality: 80, // 80% quality (good balance of size vs quality)
    );

    if (image == null) return null;

    // Upload to Supabase Storage
    return await _uploadToStorage(File(image.path), 'profile-photos');
  }

  /// Pick and upload a portfolio image (for pros showing their work).
  /// Returns the public URL or null if cancelled/failed.
  Future<String?> pickAndUploadPortfolioImage(BuildContext context) async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 85,
    );

    if (image == null) return null;

    return await _uploadToStorage(File(image.path), 'portfolio-images');
  }

  /// Uploads a file to Supabase Storage and returns the public URL.
  Future<String?> _uploadToStorage(File file, String bucket) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return null;

      // Create a unique filename: userId_timestamp.jpg
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final extension = file.path.split('.').last;
      final filePath = '$userId/$timestamp.$extension';

      // Upload the file
      await _supabase.storage.from(bucket).upload(
        filePath,
        file,
        fileOptions: const FileOptions(
          cacheControl: '3600',
          upsert: true, // Overwrite if same path exists
        ),
      );

      // Get the public URL
      final publicUrl = _supabase.storage.from(bucket).getPublicUrl(filePath);

      return publicUrl;
    } catch (e) {
      return null;
    }
  }

  /// Updates the user's profile photo URL in the database.
  Future<bool> updateProfilePhoto(String photoUrl) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return false;

      await _supabase.from('profiles').update({
        'profile_photo_url': photoUrl,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('user_id', userId);

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Picks a photo, uploads it, and saves to profile — all in one call.
  /// Returns the new photo URL, or null if anything failed/cancelled.
  Future<String?> changeProfilePhoto(BuildContext context) async {
    final url = await pickAndUploadProfilePhoto(context);
    if (url == null) return null;

    final saved = await updateProfilePhoto(url);
    return saved ? url : null;
  }
}
