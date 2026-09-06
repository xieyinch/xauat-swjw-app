import { registerRootComponent } from 'expo';

import { getDynamicColorsSync } from './modules/course-widget';
import { applyDynamicTheme } from './src/theme';

// 动态配色必须在 UI 模块（各 Screen 的 StyleSheet.create）加载前应用，
// 否则主题色会被模块加载时读取的默认品牌色冻结。
const palette = getDynamicColorsSync();
if (palette) {
  try {
    applyDynamicTheme(palette);
  } catch {
    // 解析失败时沿用默认品牌色
  }
}

// 此处再加载 App：所有界面样式将以动态主题色构建
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
