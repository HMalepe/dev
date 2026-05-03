import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useCart } from '@/hooks/useCart';
import { useInventory } from '@/hooks/useInventory';
import { StockCard } from '@/components/inventory/StockCard';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function InventoryScreen() {
  const shopId = useCart((s) => s.shopId);
  const { inventory, loading, refresh, updateQuantity } = useInventory(shopId);

  useEffect(() => {
    if (shopId) refresh();
  }, [shopId, refresh]);

  const lowStockCount = inventory.filter((i) => i.quantity <= i.low_stock_threshold).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          {lowStockCount > 0 && (
            <Text style={styles.lowStockHint}>{lowStockCount} item{lowStockCount !== 1 ? 's' : ''} low or out of stock</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/product/new')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StockCard
            item={item}
            onUpdateQuantity={(qty) => updateQuantity(item.product_id, qty)}
          />
        )}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySubtext}>Add your first product to get started</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800 },
  lowStockHint: { fontSize: FontSize.sm, color: Colors.danger, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.gray500 },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: Spacing.xs },
});
