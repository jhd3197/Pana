// Node resolve hook: maps the server's absolute URLs (/engine/*, /studio/*, /g/<game>/*)
// to files on disk, so browser modules can be imported by node --test.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('/engine/')) {
    return next(pathToFileURL(path.join(app, specifier)).href, context);
  }
  if (specifier.startsWith('/studio/')) {
    return next(pathToFileURL(path.join(app, 'web', specifier)).href, context);
  }
  const game = specifier.match(/^\/g\/([^/]+)\/(.*)$/);
  if (game) {
    return next(pathToFileURL(path.join(app, 'games', game[1], 'public', game[2])).href, context);
  }
  return next(specifier, context);
}
