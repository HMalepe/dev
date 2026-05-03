import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/hooks/useCart';
import { useInventory } from '@/hooks/useInventory';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

export default function NewProductScreen() {
  const { barcode: initialBarcode } = useLocalSearchParams<{ barcode?: string }>();
  const shopId = useCart((s) => s.shopId);
  const { addProduct } = useInventory(shopId);

  const [barcode, setBarcode] = useState(initialBarcode ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !price || !quantity) {
      Alert.alert('Missing fields', 'Name, price and quantity are required.');
      return;
    }
    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid price', 'Enter a valid price (e.g. 12.50).');
      return;
    }
    if (isNaN(parsedQty) || parsedQty < 0) {
      Alert.alert('Invalid quantity', 'Enter a valid quantity.');
      return;
    }
    if (!shopId) {
      Alert.alert('Error', 'Shop not found. Please restart the app.');
      return;
    }

    setLoading(true);
    try {
      await addProduct(
        {
          barcode: barcode || `manual-${Date.now()}`,
          name,
          category: null,
          default_price: parsedPrice,
          image_url: null,
        },
        {
          quantity: parsedQty,
          selling_price: parsedPrice,
          expiry_date: expiryDate || undefined,
        }
      );
      Alert.alert('Product added!', `${name} is now in your inventory.`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add product</Text>

        <Field label="Barcode (optional)">
          <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="e.g. 6001234567890" keyboardType="numeric" />
        </Field>
        <Field label="Product name *">
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Simba Chips 150g" autoCapitalize="words" />
        </Field>
        <Field label="Selling price (R) *">
          <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="e.g. 12.50" keyboardType="decimal-pad" />
        </Field>
        <Field label="Stock quantity *">
          <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} placeholder="e.g. 24" keyboardType="numeric" />
        </Field>
        <Field label="Expiry date (YYYY-MM-DD)">
          <TextInput style={styles.input} value={expiryDate} onChangeText={setExpiryDate} placeholder="e.g. 2025-03-15" />
        </Field>

        <Button label="Save product" onPress={handleSave} loading={loading} size="lg" style={styles.btn} />
        <Button label="Cancel" onPress={() => router.back()} variant="ghost" style={styles.btn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, paddingTop: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray600, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.gray800,
  },
  btn: { marginTop: Spacing.sm },
});
