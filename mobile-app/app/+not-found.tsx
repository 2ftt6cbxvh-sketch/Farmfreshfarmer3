import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/config';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🌿</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.text}>The page you're looking for doesn't exist.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.buttonText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  text: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
