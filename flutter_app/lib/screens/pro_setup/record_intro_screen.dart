// ============================================
// Record Voice Intro Screen
// ============================================
//
// Lets a pro record a 30-second voice intro.
// The recording is uploaded to Supabase Storage
// and the URL saved to their profile.
//
// Flow: Tap to record → Recording... (max 30s) → Preview → Save
// ============================================

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';
import '../../utils/constants.dart';

class RecordIntroScreen extends StatefulWidget {
  const RecordIntroScreen({super.key});

  @override
  State<RecordIntroScreen> createState() => _RecordIntroScreenState();
}

class _RecordIntroScreenState extends State<RecordIntroScreen> {
  final _supabase = Supabase.instance.client;
  final _recorder = AudioRecorder();

  // States: idle → recording → preview → uploading
  String _state = 'idle'; // 'idle', 'recording', 'preview', 'uploading'
  String? _filePath;
  int _seconds = 0;
  Timer? _timer;
  VideoPlayerController? _player;
  String? _existingUrl;

  static const int _maxSeconds = 30;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    try {
      final data = await _supabase
          .from('profiles')
          .select('voice_intro_url')
          .eq('user_id', userId)
          .single();
      setState(() => _existingUrl = data['voice_intro_url']);
    } catch (_) {}
  }

  Future<void> _startRecording() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission required')),
        );
      }
      return;
    }

    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/voice_intro.m4a';

    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path: path,
    );

    setState(() {
      _state = 'recording';
      _seconds = 0;
      _filePath = path;
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _seconds++);
      if (_seconds >= _maxSeconds) {
        _stopRecording();
      }
    });
  }

  Future<void> _stopRecording() async {
    _timer?.cancel();
    final path = await _recorder.stop();

    if (path != null) {
      // Set up player for preview
      _player = VideoPlayerController.file(File(path));
      await _player!.initialize();

      setState(() {
        _state = 'preview';
        _filePath = path;
      });
    } else {
      setState(() => _state = 'idle');
    }
  }

  Future<void> _playPreview() async {
    if (_player == null) return;
    await _player!.seekTo(Duration.zero);
    await _player!.play();
    setState(() {});
  }

  Future<void> _saveRecording() async {
    if (_filePath == null) return;

    setState(() => _state = 'uploading');

    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final file = File(_filePath!);
      final storagePath = '$userId/voice_intro.m4a';

      // Upload to Supabase Storage
      await _supabase.storage.from('voice-intros').upload(
        storagePath,
        file,
        fileOptions: const FileOptions(cacheControl: '3600', upsert: true),
      );

      final publicUrl =
          _supabase.storage.from('voice-intros').getPublicUrl(storagePath);

      // Update profile
      await _supabase.from('profiles').update({
        'voice_intro_url': publicUrl,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('user_id', userId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Voice intro saved!')),
        );
        Navigator.pop(context, publicUrl);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
        setState(() => _state = 'preview');
      }
    }
  }

  void _discard() {
    _player?.dispose();
    _player = null;
    if (_filePath != null) {
      File(_filePath!).deleteSync();
    }
    setState(() {
      _state = 'idle';
      _filePath = null;
      _seconds = 0;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _recorder.dispose();
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice Intro')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Instructions
            const Text(
              'Record a 30-second voice intro',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Introduce yourself! Tell clients what you do, '
              'your experience, and why they should book you.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600], fontSize: 15),
            ),

            if (_existingUrl != null && _state == 'idle') ...[
              const SizedBox(height: 16),
              Chip(
                avatar: const Icon(Icons.check_circle, color: Colors.green, size: 18),
                label: const Text('You already have a voice intro'),
                backgroundColor: Colors.green.withOpacity(0.1),
              ),
            ],

            const Spacer(),

            // Timer display
            if (_state == 'recording' || _state == 'preview')
              Text(
                '${_seconds}s / ${_maxSeconds}s',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  color: _state == 'recording' ? Colors.red : Colors.black87,
                ),
              ),

            const SizedBox(height: 24),

            // Recording visualization
            if (_state == 'recording')
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.red.withOpacity(0.1),
                  border: Border.all(color: Colors.red, width: 3),
                ),
                child: const Icon(Icons.mic, size: 56, color: Colors.red),
              ),

            if (_state == 'idle')
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppConstants.primaryColor.withOpacity(0.1),
                  border: Border.all(
                      color: AppConstants.primaryColor, width: 3),
                ),
                child: Icon(Icons.mic,
                    size: 56, color: AppConstants.primaryColor),
              ),

            if (_state == 'preview')
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.green.withOpacity(0.1),
                  border: Border.all(color: Colors.green, width: 3),
                ),
                child: const Icon(Icons.check, size: 56, color: Colors.green),
              ),

            if (_state == 'uploading')
              const Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Uploading...'),
                ],
              ),

            const Spacer(),

            // Action buttons
            if (_state == 'idle') ...[
              ElevatedButton.icon(
                onPressed: _startRecording,
                icon: const Icon(Icons.mic),
                label: Text(
                    _existingUrl != null ? 'Record New Intro' : 'Start Recording'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryColor,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                ),
              ),
            ],

            if (_state == 'recording') ...[
              ElevatedButton.icon(
                onPressed: _stopRecording,
                icon: const Icon(Icons.stop),
                label: const Text('Stop Recording'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                ),
              ),
            ],

            if (_state == 'preview') ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton.icon(
                    onPressed: _discard,
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Discard'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 14),
                    ),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: _playPreview,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Play'),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 14),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: _saveRecording,
                    icon: const Icon(Icons.check),
                    label: const Text('Save'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppConstants.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 14),
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
