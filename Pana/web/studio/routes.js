// Small, testable router. Server routes serve the shell for direct visits.
const root = '/studio';
export function readRoute(url) {
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/studio.html' && url.hash) {
    try { return { page: 'asset', id: alias(decodeURIComponent(url.hash.slice(1))) }; }
    catch { return { page: 'missing', id: '' }; }
  }
  if (path.startsWith(root + '/assets/')) {
    try { return { page: 'asset', id: alias(decodeURIComponent(path.slice((root + '/assets/').length))) }; }
    catch { return { page: 'missing', id: '' }; }
  }
  return { page: path === root + '/workspace' ? 'workspace' : 'library', id: '' };
}
const alias = id => id === 'track-playa' ? 'track-bululu' : id;
export function assetURL(id, search = '') { return root + '/assets/' + encodeURIComponent(id) + search; }
export function libraryURL(params, workspace = false) {
  const query = new URLSearchParams(params); query.delete('workspace');
  return root + (workspace ? '/workspace' : '/library') + (query.size ? '?' + query : '');
}
export const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterAssets(assets, params, workset, workspace = false) {
  const query = normalize(params.get('q') || '').trim();
  return assets.filter(asset =>
    (!workspace || workset.has(asset.id)) &&
    (!params.get('category') || asset.category === params.get('category')) &&
    (!params.get('game') || asset.usedBy.includes(params.get('game'))) &&
    (!params.get('pack') || asset.pack === params.get('pack')) &&
    normalize([asset.name, asset.id, asset.source, asset.factory, asset.pack || '', ...asset.usedBy, ...(asset.tags || [])].join(' ')).includes(query));
}
