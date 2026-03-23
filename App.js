// Expo 앱 진입점 - WebView로 기존 웹 앱을 감싸서 네이티브 앱으로 변환
import React from 'react';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Platform } from 'react-native';

// 배포된 웹 앱 URL (Firebase Hosting)
const WEB_APP_URL = 'https://day100-web.web.app';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        // 자바스크립트 활성화
        javaScriptEnabled={true}
        // DOM 스토리지 활성화 (localStorage 등)
        domStorageEnabled={true}
        // 시작 시 확대/축소 비활성화
        scalesPageToFit={true}
        // 뒤로가기 버튼 처리 (안드로이드)
        allowsBackForwardNavigationGestures={true}
        // 미디어 재생 설정
        mediaPlaybackRequiresUserAction={false}
        // 혼합 콘텐츠 허용
        mixedContentMode="compatibility"
        // 서드파티 쿠키 허용
        thirdPartyCookiesEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // 안드로이드 상태바 높이만큼 패딩 추가
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  webview: {
    flex: 1,
  },
});
