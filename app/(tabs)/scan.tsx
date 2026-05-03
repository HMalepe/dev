import React, { useState, useCallback } from 'react';
import { View, Modal, StyleSheet, Text } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { ProductNotFound } from '@/components/scanner/ProductNotFound';
import { CartSummary } from '@/components/cart/CartSummary';
import { useCart } from '@/hooks/useCart';
import { lookupProduct } from '@/lib/barcode';
import { Colors, FontSize, Spacing } from '@/constants/theme';

type ScanState = 'scanning' | 'found' | 'not_found';

export default function ScanScreen() {
  const { addItem } = useCart();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [scannerActive, setScannerActive] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useFocusEffect(
    useCallback(() => {
      setScannerActive(true);
      return () => setScannerActive(false);
    }, [])
  );

  const handleScan = async (barcode: string) => {
    setScannerActive(false);
    const product = await lookupProduct(barcode);

    if (product) {
      addItem(product);
      setFeedbackMsg(`Added: ${product.name}`);
      setTimeout(() => {
        setFeedbackMsg('');
        setScannerActive(true);
      }, 1200);
    } else {
      setNotFoundBarcode(barcode);
      setScanState('not_found');
    }
  };

  const handleDismissNotFound = () => {
    setScanState('scanning');
    setNotFoundBarcode('');
    setScannerActive(true);
  };

  return (
    <View style={styles.container}>
      {/* Top half: camera */}
      <View style={styles.scanArea}>
        <BarcodeScanner onScan={handleScan} active={scannerActive} />
        {feedbackMsg ? (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedbackMsg}</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom half: cart */}
      <View style={styles.cartArea}>
        <CartSummary onCheckout={() => router.push('/checkout')} />
      </View>

      {/* Product not found overlay */}
      <Modal
        visible={scanState === 'not_found'}
        transparent
        animationType="slide"
        onRequestClose={handleDismissNotFound}
      >
        <View style={styles.modalBg}>
          <ProductNotFound barcode={notFoundBarcode} onDismiss={handleDismissNotFound} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scanArea: { flex: 1, maxHeight: '45%' },
  cartArea: { flex: 1 },
  feedbackBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.success,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  feedbackText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
});
