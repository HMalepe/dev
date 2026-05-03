import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/hooks/useCart';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setShopId = useCart((s) => s.setShopId);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/login');
      } else {
        // Try remote first; fall back to cached value for offline launch
        try {
          const { data } = await supabase
            .from('shops')
            .select('id, name')
            .eq('owner_id', session.user.id)
            .single();
          if (data) {
            await AsyncStorage.setItem('shop_id', data.id);
            await AsyncStorage.setItem('shop_name', data.name);
            setShopId(data.id);
          }
        } catch {
          const cached = await AsyncStorage.getItem('shop_id');
          if (cached) setShopId(cached);
        }
      }
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.replace('/auth/login');
      } else {
        const cached = await AsyncStorage.getItem('shop_id');
        if (cached) setShopId(cached);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white, headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ title: 'Checkout', presentation: 'modal' }} />
        <Stack.Screen name="product/new" options={{ title: 'Add Product' }} />
        <Stack.Screen name="product/[barcode]" options={{ title: 'Product' }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ title: 'Create account' }} />
      </Stack>
    </>
  );
}
