import React, { useState, useRef } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, SafeAreaView, Platform, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../lib/theme';

const PRODUCTION_WEB_URL = 'https://farmfreshfarmer.com';

export default function FullWebAppScreen() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(PRODUCTION_WEB_URL);

  const bg = isDark ? '#000000' : '#0f172a';
  const barBg = isDark ? '#092615' : '#064e3b';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Top Controls Bar */}
      <View style={[styles.topBar, { backgroundColor: barBg, paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.leftControls}>
          {canGoBack && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => webViewRef.current?.goBack()}>
              <Text style={styles.iconBtnText}>◀ Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => webViewRef.current?.reload()}>
            <Text style={styles.iconBtnText}>🔄 Reload</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerBadge}>
          <Text style={styles.centerBadgeText}>🌿 FarmFresh Web Live</Text>
        </View>

        <TouchableOpacity
          style={styles.adminBtn}
          onPress={() => {
            webViewRef.current?.injectJavaScript("window.location.hash = '#/admin'; true;");
          }}
        >
          <Text style={styles.adminBtnText}>🛡️ Admin</Text>
        </TouchableOpacity>
      </View>

      {/* Main WebView Rendering 1:1 Website Experience */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: PRODUCTION_WEB_URL }}
          style={{ flex: 1, backgroundColor: bg }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          geolocationEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          cacheEnabled={true}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            setCurrentUrl(navState.url);
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#10b981" size="large" />
              <Text style={styles.loadingText}>Loading 1:1 Live Web Experience…</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justify.content: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.3)',
  },
  leftControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  centerBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  centerBadgeText: { color: '#34d399', fontSize: 11, fontWeight: '800' },
  adminBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  adminBtnText: { color: '#000000', fontSize: 11, fontWeight: '900' },
  webViewContainer: { flex: 1 },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: { color: '#34d399', fontSize: 13, fontWeight: '700', marginTop: 12 },
});
