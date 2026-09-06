import { registerRootComponent } from 'expo';

import { getDynamicColorsSync, dynamicColorDiag } from './modules/course-widget';
import { applyDynamicTheme, themeInitDiagnostics } from './src/theme';

// 动态配色必须在 UI 模块（各 Screen 的 StyleSheet.create）加载前应用，
// 否则主题色会被模块加载时读取的默认品牌色冻结。
const palette = getDynamicColorsSync();
if (palette && palette.a1_500) {
  try {
    applyDynamicTheme(palette);
    themeInitDiagnostics.state = `ok:${palette.a1_500}`;
  } catch (e) {
    themeInitDiagnostics.state = `apply-error:${(e as Error).message}`;
  }
} else {
  themeInitDiagnostics.state = `no-palette:${dynamicColorDiag.reason}`;
}

// 此处再加载 App：所有界面样式将以动态主题色构建
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
