import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'activeTab',
  ],
  host_permissions: [
    'http://localhost:5173/*',
    'ws://localhost:5173/*',
    '<all_urls>',
  ],
  commands: {
    toggle_side_panel: {
      suggested_key: {
        default: 'Ctrl+K',
      },
      description: 'Toggle Side Panel',
    },
    save_current_url: {
      suggested_key: {
        default: 'Ctrl+Shift+S',
      },
      description: 'Save current URL to search',
    },
  },
  options_ui: {
    page: 'src/settings/index.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      js: ['src/content/main.tsx'],
      matches: ['<all_urls>'],
    },
    {
      js: ['src/content/link-hints.tsx'],
      matches: ['<all_urls>'],
    },
    {
      js: ['src/content/input-completion.tsx'],
      matches: ['<all_urls>'],
    },
    {
      js: ['src/content/automation.ts'],
      matches: ['<all_urls>'],
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background.ts',
  },
})
