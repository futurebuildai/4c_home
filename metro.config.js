// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-appwrite (1.2.0) imports the pre-SDK-54 `expo-file-system`
// API (readAsStringAsync, cacheDirectory, …), which now lives at
// `expo-file-system/legacy`. Redirect only that package's import.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'expo-file-system' &&
    context.originModulePath.includes('react-native-appwrite')
  ) {
    return context.resolveRequest(context, 'expo-file-system/legacy', platform);
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
