import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../providers/auth_provider.dart';
import '../../services/photo_service.dart';
import '../../utils/constants.dart';
import '../auth/login_screen.dart';
import '../pro_setup/manage_services_screen.dart';
import '../pro_setup/portfolio_screen.dart';
import '../pro_setup/record_intro_screen.dart';

/// User profile and app settings screen.
/// Shows personal info, pro settings (if applicable), and app preferences.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _supabase = Supabase.instance.client;
  final _photoService = PhotoService();
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _proProfile;
  bool _isLoading = true;
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final profileData =
          await _supabase.from('profiles').select().eq('user_id', userId).single();

      setState(() => _profile = profileData);

      // Check if user is a pro
      try {
        final proData = await _supabase
            .from('pro_profiles')
            .select()
            .eq('user_id', userId)
            .single();
        setState(() => _proProfile = proData);
      } catch (_) {
        // Not a pro - that's fine
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load profile: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateDisplayName(String newName) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      await _supabase
          .from('profiles')
          .update({'display_name': newName}).eq('user_id', userId);

      setState(() => _profile?['display_name'] = newName);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Name updated')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update: $e')),
        );
      }
    }
  }

  Future<void> _updateBio(String newBio) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      await _supabase
          .from('profiles')
          .update({'bio': newBio}).eq('user_id', userId);

      setState(() => _profile?['bio'] = newBio);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bio updated')),
        );
      }
    } catch (_) {}
  }

  Future<void> _updateServiceRadius(int radiusKm) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      await _supabase
          .from('pro_profiles')
          .update({'service_radius_km': radiusKm}).eq('user_id', userId);

      setState(() => _proProfile?['service_radius_km'] = radiusKm);
    } catch (_) {}
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('Are you sure you want to log out of VouchSA?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Log out', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  void _showEditDialog(String title, String currentValue, Function(String) onSave) {
    final controller = TextEditingController(text: currentValue);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Edit $title'),
        content: TextField(
          controller: controller,
          maxLines: title == 'Bio' ? 4 : 1,
          maxLength: title == 'Bio' ? 200 : 100,
          decoration: InputDecoration(hintText: 'Enter your $title'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              onSave(controller.text.trim());
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile & Settings')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                // Profile header
                Container(
                  padding: const EdgeInsets.all(24),
                  color: AppConstants.primaryColor.withOpacity(0.05),
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: _isUploadingPhoto
                            ? null
                            : () async {
                                setState(() => _isUploadingPhoto = true);
                                final url = await _photoService
                                    .changeProfilePhoto(context);
                                setState(() {
                                  _isUploadingPhoto = false;
                                  if (url != null) {
                                    _profile?['profile_photo_url'] = url;
                                  }
                                });
                                if (url != null && mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text('Photo updated')),
                                  );
                                }
                              },
                        child: Stack(
                          children: [
                            CircleAvatar(
                              radius: 50,
                              backgroundImage:
                                  _profile?['profile_photo_url'] != null
                                      ? NetworkImage(
                                          _profile!['profile_photo_url'])
                                      : null,
                              child: _isUploadingPhoto
                                  ? const CircularProgressIndicator()
                                  : _profile?['profile_photo_url'] == null
                                      ? const Icon(Icons.person, size: 50)
                                      : null,
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppConstants.primaryColor,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: Colors.white, width: 2),
                                ),
                                child: const Icon(Icons.camera_alt,
                                    size: 16, color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _profile?['display_name'] ?? 'Unknown',
                        style: const TextStyle(
                            fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _supabase.auth.currentUser?.phone ?? '',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                      if (_proProfile != null) ...[
                        const SizedBox(height: 8),
                        Chip(
                          avatar: const Icon(Icons.verified, size: 16),
                          label: Text(
                            _proProfile!['certification_status']
                                    ?.toString()
                                    .toUpperCase() ??
                                'NEW',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Personal Info section
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 24, 16, 8),
                  child: Text('PERSONAL INFO',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey)),
                ),
                ListTile(
                  leading: const Icon(Icons.person),
                  title: const Text('Display Name'),
                  subtitle: Text(_profile?['display_name'] ?? ''),
                  trailing: const Icon(Icons.edit, size: 20),
                  onTap: () => _showEditDialog(
                    'Name',
                    _profile?['display_name'] ?? '',
                    _updateDisplayName,
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('Bio'),
                  subtitle: Text(_profile?['bio'] ?? 'No bio yet'),
                  trailing: const Icon(Icons.edit, size: 20),
                  onTap: () => _showEditDialog(
                    'Bio',
                    _profile?['bio'] ?? '',
                    _updateBio,
                  ),
                ),
                // Pro Settings (only if user is a pro)
                if (_proProfile != null) ...[
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text('PRO SETTINGS',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey)),
                  ),
                  ListTile(
                    leading: const Icon(Icons.attach_money),
                    title: const Text('Hourly Rate'),
                    subtitle: Text(
                        'R${_proProfile?['hourly_rate']?.toStringAsFixed(0) ?? '0'}/hr'),
                    trailing: const Icon(Icons.edit, size: 20),
                    onTap: () => _showEditDialog(
                      'Hourly Rate (Rands)',
                      _proProfile?['hourly_rate']?.toString() ?? '0',
                      (value) async {
                        final rate = double.tryParse(value);
                        if (rate == null || rate <= 0) return;
                        final userId = _supabase.auth.currentUser?.id;
                        if (userId == null) return;
                        await _supabase.from('pro_profiles').update(
                            {'hourly_rate': rate}).eq('user_id', userId);
                        setState(() => _proProfile?['hourly_rate'] = rate);
                      },
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.map),
                    title: const Text('Service Radius'),
                    subtitle: Text(
                        '${_proProfile?['service_radius_km'] ?? 10} km'),
                    trailing: SizedBox(
                      width: 150,
                      child: Slider(
                        value: (_proProfile?['service_radius_km'] ?? 10)
                            .toDouble(),
                        min: 1,
                        max: 50,
                        divisions: 49,
                        label:
                            '${_proProfile?['service_radius_km'] ?? 10} km',
                        onChanged: (value) {
                          setState(() =>
                              _proProfile?['service_radius_km'] =
                                  value.round());
                        },
                        onChangeEnd: (value) =>
                            _updateServiceRadius(value.round()),
                      ),
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.build),
                    title: const Text('My Services'),
                    subtitle: const Text('Add, edit, or remove services'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const ManageServicesScreen()),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.photo_library),
                    title: const Text('My Portfolio'),
                    subtitle: const Text('Upload work samples'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const PortfolioScreen()),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.mic),
                    title: const Text('Voice Intro'),
                    subtitle: const Text('Record a 30-second intro'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const RecordIntroScreen()),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.account_balance),
                    title: const Text('Bank Details'),
                    subtitle: Text(_proProfile?['bank_name'] ?? 'Not set'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      // Bank details editing would go here
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Bank details editor coming soon')),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.bar_chart),
                    title: const Text('Stats'),
                    subtitle: Text(
                      '${_proProfile?['total_jobs_completed'] ?? 0} jobs completed  |  '
                      '${_proProfile?['vouch_count'] ?? 0} vouches',
                    ),
                  ),
                ],

                // App Settings
                const Divider(),
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text('APP',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey)),
                ),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: const Text('Help & Support'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('support@vouchsa.co.za')),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: const Text('Privacy Policy'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
                ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: const Text('Terms of Service'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
                const SizedBox(height: 16),

                // Logout
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: OutlinedButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout, color: Colors.red),
                    label: const Text('Log Out',
                        style: TextStyle(color: Colors.red)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.all(16),
                    ),
                  ),
                ),

                // App version
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text('VouchSA v1.0.0',
                        style: TextStyle(color: Colors.grey[400])),
                  ),
                ),
              ],
            ),
    );
  }
}
