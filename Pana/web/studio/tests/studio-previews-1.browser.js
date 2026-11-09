// node studio-previews-1.browser.js [absolute-playwright-package] [browser-executable]
// Every third catalog entry, starting with entry 0; see preview-kit.js.
import { previewShard } from './preview-kit.js';
await previewShard(0, 3);
