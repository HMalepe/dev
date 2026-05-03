import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/hooks/useCart';
import { getTodaySales, getPendingSyncCount, getInventoryByShop, getExpiringInventory } from '@/lib/db';
import { useSync } from '@/hooks/useSync';
import { SyncStatusBar } from '@/components/ui/SyncStatusBar';
import { formatZAR } from '@/lib/currency';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { DashboardStats } from '@/types';

export default function DashboardScreen() {
  const shopId = useCart((s) => s.shopId);
  const [shopName, setShopName] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    today_sales_count: 0,
    today_revenue: 0,
    low_stock_count: 0,
    expiring_soon_count: 0,
    pending_sync_count: 0,
  });
  const { syncStatus, pendingCount, triggerSync } = useSync();

  useEffect(() => {
    AsyncStorage.getItem('shop_name').then((name) => {
      if (name) setShopName(name);
    });
  }, []);

  const loadStats = useCallback(async () => {
    if (!shopId) return;
    const [sales, inventory, expiring, pendingSync] = await Promise.all([
      getTodaySales(shopId),
      getInventoryByShop(shopId),
      getExpiringInventory(shopId, 7),
      getPendingSyncCount(),
    ]);
    const lowStockCount = inventory.filter((i) => i.quantity <= i.low_stock_threshold).length;
    setStats({
      today_sales_count: sales.count,
      today_revenue: sales.revenue,
      low_stock_count: lowStockCount,
      expiring_soon_count: expiring.length,
      pending_sync_count: pendingSync,
    });
  }, [shopId]);

  useFocusEffect(useCallback(() => {
    loadStats();
  }, [loadStats]));

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SyncStatusBar status={syncStatus} pendingCount={pendingCount} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Dashboard</Text>
            {shopName ? <Text style={styles.shopName}>{shopName}</Text> : null}
          </View>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.statsRow}>
          <StatCard label="Sales" value={String(stats.today_sales_count)} color={Colors.primary} />
          <StatCard label="Revenue" value={formatZAR(stats.today_revenue)} color={Colors.success} />
        </View>

        <Text style={styles.sectionTitle}>Alerts</Text>
        <View style={styles.statsRow}>
          <StatCard
            label="Low stock"
            value={String(stats.low_stock_count)}
            color={stats.low_stock_count > 0 ? Colors.warning : Colors.gray300}
          />
          <StatCard
            label="Expiring soon"
            value={String(stats.expiring_soon_count)}
            color={stats.expiring_soon_count > 0 ? Colors.danger : Colors.gray300}
          />
        </View>

        {pendingCount > 0 && (
          <TouchableOpacity style={styles.syncCard} onPress={triggerSync}>
            <Text style={styles.syncCardText}>
              {pendingCount} sale{pendingCount !== 1 ? 's' : ''} waiting to sync · Tap to sync now
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  greeting: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800 },
  shopName: { fontSize: FontSize.md, color: Colors.gray400, marginTop: 2 },
  signOut: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '600' },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray400, letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800, marginBottom: 4 },
  statLabel: { fontSize: FontSize.sm, color: Colors.gray400 },
  syncCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  syncCardText: { fontSize: FontSize.sm, color: Colors.info, fontWeight: '600', textAlign: 'center' },
});
