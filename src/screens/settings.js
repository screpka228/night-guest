import { navigate } from '../router.js';
import { mountSettingsPanel } from './settings-panel.js';

export function mountSettings(root) {
  const panel = mountSettingsPanel(root, { onBack: () => navigate('menu') });
  return () => panel.destroy();
}
