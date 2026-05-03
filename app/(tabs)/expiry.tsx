import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useCart } from '@/hooks/useCart';
import { useInventory } from '@/hooks/useInventory';
import { ExpiryAlert } from '@/components/expiry/ExpiryAlert';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function ExpiryScreen() {
  const shopId = useCart((s) => s.shopId);
  const { expiring, loading, refresh } = useInventory(shopId);

  useEffect(() => {
    if (shopId) refresh();
  }, [shopId, refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expiry Alerts</Text>
        <Text style={styles.subtitle}>Items expiring within 7 days</Text>
      </View>

      <FlatList
        data={expiring}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExpiryAlert item={item} />}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>No expiring stock</Text>
            <Text style={styles.emptySubtext}>All your stock is good for more than 7 days</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, paddingTop: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800 },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 2 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.gray500 },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: Spacing.xs, textAlign: 'center' },
});
