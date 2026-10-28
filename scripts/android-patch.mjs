// Патчи сгенерированного android-проекта (папка android/ в .gitignore, создаётся `cap add android`).
//   node scripts/android-patch.mjs base     — разрешение на вибрацию, ландшафт, версия из package.json
//   node scripts/android-patch.mjs signing  — подпись release (пароли из переменных окружения)
import fs from 'node:fs';

const mode = process.argv[2];
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const gradlePath = 'android/app/build.gradle';
const manifestPath = 'android/app/src/main/AndroidManifest.xml';

if (mode === 'base') {
  let m = fs.readFileSync(manifestPath, 'utf8');
  if (!m.includes('android.permission.VIBRATE')) {
    m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
  }
  if (!m.includes('android:screenOrientation')) {
    m = m.replace('<activity', '<activity android:screenOrientation="sensorLandscape"');
  }
  fs.writeFileSync(manifestPath, m);

  let g = fs.readFileSync(gradlePath, 'utf8');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${pkg.buildNumber || 1}`);
  g = g.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
  fs.writeFileSync(gradlePath, g);
  console.log(`android: v${pkg.version} (${pkg.buildNumber})`);
} else if (mode === 'signing') {
  const need = ['ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
  for (const k of need) {
    if (!process.env[k]) {
      console.error(`Не задан секрет ${k}`);
      process.exit(1);
    }
  }
  // значения для groovy-строки в одинарных кавычках
  const q = (v) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const signing = `
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword '${q(process.env.ANDROID_KEYSTORE_PASSWORD)}'
            keyAlias '${q(process.env.ANDROID_KEY_ALIAS)}'
            keyPassword '${q(process.env.ANDROID_KEY_PASSWORD)}'
        }
    }
`;
  let g = fs.readFileSync(gradlePath, 'utf8');
  if (!/android\s*\{/.test(g) || !/buildTypes\s*\{[^}]*release\s*\{/.test(g)) {
    console.error('build.gradle: не найден блок android или buildTypes.release');
    process.exit(1);
  }
  g = g.replace(/android\s*\{/, (m) => m + signing);
  g = g.replace(/buildTypes\s*\{[^}]*release\s*\{/, (m) => m + '\n            signingConfig signingConfigs.release');
  fs.writeFileSync(gradlePath, g);
  console.log('android: signingConfig release добавлен');
} else {
  console.error('usage: android-patch.mjs base|signing');
  process.exit(1);
}
