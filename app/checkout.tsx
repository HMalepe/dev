import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCart } from '@/hooks/useCart';
import { useSync } from '@/hooks/useSync';
import { ChangeCalculator } from '@/components/cart/ChangeCalculator';
import { Button } from '@/components/ui/Button';
import { formatZAR } from '@/lib/currency';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

type PayStep = 'review' | 'change_calc' | 'done';

export default function CheckoutScreen() {
  const { items, getTotal, clearCart, completeSale } = useCart();
  const { triggerSync } = useSync();

  const [step, setStep] = useState<PayStep>('review');
  const [cashReceived, setCashReceived] = useState(0);
  const [changeGiven, setChangeGiven] = useState(0);
  const [loading, setLoading] = useState(false);

  const total = getTotal();

  const handleCashConfirmed = (cash: number, change: number) => {
    setCashReceived(cash);
    setChangeGiven(change);
  };

  const handleCompleteSale = async (method: 'cash' | 'card') => {
    setLoading(true);
    try {
      await completeSale({
        paymentMethod: method,
        cashReceived: method === 'cash' ? cashReceived : undefined,
        changeGiven: method === 'cash' ? changeGiven : undefined,
      });
      setStep('done');
      triggerSync();
    } catch (err) {
      Alert.alert('Sale failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Sale complete!</Text>
        {changeGiven > 0 && (
          <View style={styles.changeDisplay}>
            <Text style={styles.changeLabel}>Give Gogo</Text>
            <Text style={styles.changeAmount}>{formatZAR(changeGiven)}</Text>
          </View>
        )}
        <Button
          label="New sale"
          onPress={() => {
            clearCart();
            router.replace('/(tabs)/scan');
          }}
          size="lg"
          style={styles.newSaleBtn}
        />
      </View>
    );
  }

  if (step === 'change_calc') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Cash payment</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmt}>{formatZAR(total)}</Text>
        </View>
        <ChangeCalculator totalAmount={total} onCashConfirmed={handleCashConfirmed} />
        <Button
          label={`Complete sale — ${formatZAR(total)}`}
          onPress={() => handleCompleteSale('cash')}
          loading={loading}
          disabled={cashReceived < total}
          size="lg"
          style={styles.completeBtn}
        />
        <Button label="Back" onPress={() => setStep('review')} variant="ghost" style={styles.backBtn} />
      </ScrollView>
    );
  }

  // Review step
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Order summary</Text>
        {items.map((item) => (
          <View key={item.product.id} style={styles.lineItem}>
            <Text style={styles.lineItemName} numberOfLines={1}>{item.product.name}</Text>
            <Text style={styles.lineItemQty}>×{item.quantity}</Text>
            <Text style={styles.lineItemTotal}>{formatZAR(item.quantity * item.unit_price)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmt}>{formatZAR(total)}</Text>
        </View>
      </ScrollView>

      <View style={styles.paymentOptions}>
        <Text style={styles.payLabel}>How is customer paying?</Text>
        <Button
          label="💵  Cash"
          onPress={() => setStep('change_calc')}
          size="lg"
          style={styles.payBtn}
        />
        <Button
          label="💳  Card"
          onPress={() => handleCompleteSale('card')}
          variant="secondary"
          size="lg"
          loading={loading}
          style={styles.payBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray800, marginBottom: Spacing.md },
  lineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  lineItemName: { flex: 1, fontSize: FontSize.md, color: Colors.gray700 },
  lineItemQty: { fontSize: FontSize.md, color: Colors.gray400, marginRight: Spacing.md },
  lineItemTotal: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray800 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  totalLabel: { fontSize: FontSize.lg, color: Colors.gray600 },
  totalAmt: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.primary },
  paymentOptions: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  payLabel: { fontSize: FontSize.sm, color: Colors.gray500, marginBottom: Spacing.md, textAlign: 'center' },
  payBtn: { marginBottom: Spacing.sm, borderRadius: BorderRadius.lg },
  completeBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.lg },
  backBtn: { marginTop: Spacing.sm },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xl },
  doneIcon: { fontSize: 72, marginBottom: Spacing.lg },
  doneTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray800, marginBottom: Spacing.xl },
  changeDisplay: {
    backgroundColor: '#D1FAE5',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    width: '100%',
  },
  changeLabel: { fontSize: FontSize.md, color: Colors.gray600, marginBottom: Spacing.sm },
  changeAmount: { fontSize: 48, fontWeight: '800', color: Colors.success },
  newSaleBtn: { width: '100%', borderRadius: BorderRadius.lg },
});
