// Follow local module dependencies so changing shared geometry invalidates its consumers.
// Remote Three.js version and the render recipe are covered by the renderer/catalog text.
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), n => n.toString(16).padStart(2, '0')).join('');
export function createFingerprinter() {
  const responses = new Map();
  const read = url => {
    if (!responses.has(url)) responses.set(url, fetch(url, { cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error(`No se pudo validar ${url}`);
      return response.text();
    }).catch(error => { responses.delete(url); throw error; }));
    return responses.get(url);
  };
  return async function fingerprints(assets) {
    const files = new Map(), pending = new Set(assets.flatMap(a => [a.source, ...(a.dependencies || [])]));
    const recipe = ['/studio/catalog.js', '/studio/catalog/objects.js', '/studio/preview.js', '/studio.html'];
    recipe.forEach(url => pending.add(url));
    while (pending.size) {
      const batch = [...pending].slice(0, 8); batch.forEach(url => pending.delete(url));
      await Promise.all(batch.map(async url => {
        if (files.has(url)) return;
        const source = await read(url), dependencies = [];
        // Static imports/re-exports and literal dynamic imports. Ignore bare/CDN imports.
        // Adapters describe multiple assets. Hash them without walking unrelated
        // constructors; source and explicit dependencies describe this asset.
        if (!recipe.includes(url) && !url.startsWith('/studio/catalog/')) for (const match of source.matchAll(/(?:\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g)) {
          if (!match[1].startsWith('.') && !match[1].startsWith('/')) continue;
          const target = new URL(match[1], new URL(url, location.origin));
          if (target.origin !== location.origin || !target.pathname.endsWith('.js')) continue;
          dependencies.push(target.pathname); if (!files.has(target.pathname)) pending.add(target.pathname);
        }
        files.set(url, { hash: await hash(source), dependencies });
      }));
    }
    const common = recipe.map(url => files.get(url).hash).join('/');
    return new Map(await Promise.all(assets.map(async asset => {
      const visited = new Set(), walk = url => { if (visited.has(url)) return; visited.add(url); files.get(url).dependencies.forEach(walk); };
      walk(asset.source); asset.dependencies?.forEach(walk);
      const inputs = [...visited].sort().map(url => `${url}:${files.get(url).hash}`).join('\n');
      return [asset.id, await hash(`thumbnail-v1/${common}/${JSON.stringify(asset)}/${inputs}`)];
    })));
  };
}
export const fingerprints = assets => createFingerprinter()(assets);
