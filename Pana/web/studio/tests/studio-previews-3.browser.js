// node studio-previews-3.browser.js [absolute-playwright-package] [browser-executable]
// Every third catalog entry, starting with entry 2; see preview-kit.js.
import { previewShard } from './preview-kit.js';
await previewShard(2, 3);
