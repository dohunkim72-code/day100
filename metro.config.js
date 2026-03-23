// Metro 번들러 설정 - Expo 프로젝트용
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
