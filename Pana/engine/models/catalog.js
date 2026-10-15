// Shared catalog is data only. Consumers choose how and when to load a model.
import fauna from './fauna/catalog.js';
import vegetation from './vegetation/catalog.js';
import props from './props/catalog.js';

export const MODEL_DEFINITIONS = [...fauna, ...vegetation, ...props];
