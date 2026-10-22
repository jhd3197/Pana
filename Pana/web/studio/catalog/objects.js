export function object(definition) {
  return { ...definition, async build() {
    const { Box3, Vector3 } = await import('three');
    const module = await import(definition.source);
    const factory = module[definition.factory];
    if (typeof factory !== 'function') throw new Error(`Missing model factory: ${definition.id}`);
    const group = factory(...(definition.previewArgs ?? [definition.previewOptions ?? undefined])), frame = group.userData.previewBounds;
    return { group, bounds: frame && new Box3(new Vector3(...frame[0]), new Vector3(...frame[1])), update: group.userData.tick && ((t, dt) => group.userData.tick(t, dt)) };
  } };
}
