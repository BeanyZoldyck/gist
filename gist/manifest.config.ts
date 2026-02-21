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
  ],
  options_ui: {
    page: 'src/settings/index.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      js: ['src/content/main.tsx'],
      matches: ['https://*/*'],
    },
    {
      js: ['src/content/link-hints.tsx'],
      matches: ['https://*/*'],
    },
    {
      js: ['src/content/input-completion.tsx'],
      matches: ['https://*/*'],
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
