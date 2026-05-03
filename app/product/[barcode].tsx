import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCart } from '@/hooks/useCart';
import { useInventory } from '@/hooks/useInventory';
import { StockCard } from '@/components/inventory/StockCard';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { InventoryItem, Product } from '@/types';

export default function ProductDetailScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const shopId = useCart((s) => s.shopId);
  const { inventory, loading, refresh, updateQuantity } = useInventory(shopId);
  const [item, setItem] = useState<(InventoryItem & { product: Product }) | null>(null);

  useEffect(() => {
    if (shopId) refresh();
  }, [shopId, refresh]);

  useEffect(() => {
    const found = inventory.find((i) => i.product.barcode === barcode);
    setItem(found ?? null);
  }, [inventory, barcode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Product not found</Text>
        <Button label="Go back" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.barcode}>{barcode}</Text>
      <StockCard
        item={item}
        onUpdateQuantity={(qty) => {
          updateQuantity(item.product_id, qty);
          Alert.alert('Updated', `Stock set to ${qty} units.`);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  barcode: { fontSize: FontSize.sm, color: Colors.gray400, fontFamily: 'monospace', marginBottom: Spacing.md },
  loadingText: { fontSize: FontSize.md, color: Colors.gray400 },
  notFound: { fontSize: FontSize.lg, color: Colors.gray600, marginBottom: Spacing.lg },
});
