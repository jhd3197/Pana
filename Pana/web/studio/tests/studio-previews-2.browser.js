// node studio-previews-2.browser.js [absolute-playwright-package] [browser-executable]
// Every third catalog entry, starting with entry 1; see preview-kit.js.
import { previewShard } from './preview-kit.js';
await previewShard(1, 3);
