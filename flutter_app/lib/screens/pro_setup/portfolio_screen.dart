// ============================================
// Portfolio Screen - Pro Work Samples
// ============================================
//
// Lets pros upload photos of their work.
// Clients see these on the pro's profile as a gallery.
// ============================================

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/photo_service.dart';
import '../../utils/constants.dart';

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> {
  final _supabase = Supabase.instance.client;
  final _photoService = PhotoService();
  List<Map<String, dynamic>> _images = [];
  bool _isLoading = true;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _loadPortfolio();
  }

  Future<void> _loadPortfolio() async {
    setState(() => _isLoading = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final data = await _supabase
          .from('pro_portfolio')
          .select()
          .eq('pro_id', userId)
          .order('created_at', ascending: false);

      setState(() => _images = List<Map<String, dynamic>>.from(data));
    } catch (_) {}
    setState(() => _isLoading = false);
  }

  Future<void> _addPhoto() async {
    setState(() => _isUploading = true);

    final url = await _photoService.pickAndUploadPortfolioImage(context);
    if (url == null) {
      setState(() => _isUploading = false);
      return;
    }

    // Ask for a caption
    String? caption;
    if (mounted) {
      caption = await _showCaptionDialog();
    }

    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      await _supabase.from('pro_portfolio').insert({
        'pro_id': userId,
        'image_url': url,
        'caption': caption,
        'is_verified': false,
      });

      _loadPortfolio();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }

    setState(() => _isUploading = false);
  }

  Future<String?> _showCaptionDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add a Caption'),
        content: TextField(
          controller: controller,
          maxLength: 100,
          decoration: const InputDecoration(
            hintText: 'e.g. Fresh fade for a client in Sandton',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: const Text('Skip'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteImage(String imageId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this photo?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _supabase.from('pro_portfolio').delete().eq('id', imageId);
        _loadPortfolio();
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Portfolio')),
      floatingActionButton: FloatingActionButton(
        onPressed: _isUploading ? null : _addPhoto,
        backgroundColor: AppConstants.primaryColor,
        child: _isUploading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.add_a_photo, color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _images.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.photo_library_outlined,
                            size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        const Text('No work samples yet',
                            style: TextStyle(fontSize: 18)),
                        const SizedBox(height: 8),
                        Text(
                          'Upload photos of your best work.\nClients love seeing examples!',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadPortfolio,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(8),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: _images.length,
                    itemBuilder: (context, index) {
                      final img = _images[index];
                      return GestureDetector(
                        onLongPress: () => _deleteImage(img['id']),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.network(
                                img['image_url'],
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: Colors.grey[200],
                                  child: const Icon(Icons.broken_image),
                                ),
                              ),
                              // Caption overlay
                              if (img['caption'] != null &&
                                  img['caption'].toString().isNotEmpty)
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.bottomCenter,
                                        end: Alignment.topCenter,
                                        colors: [
                                          Colors.black.withOpacity(0.7),
                                          Colors.transparent,
                                        ],
                                      ),
                                    ),
                                    child: Text(
                                      img['caption'],
                                      style: const TextStyle(
                                          color: Colors.white, fontSize: 12),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              // Verified badge
                              if (img['is_verified'] == true)
                                Positioned(
                                  top: 8,
                                  right: 8,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.green,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.verified,
                                            size: 12, color: Colors.white),
                                        SizedBox(width: 2),
                                        Text('Verified',
                                            style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 10)),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
