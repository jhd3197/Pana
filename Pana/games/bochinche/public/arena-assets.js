// Factories own geometry, but many cache materials. Give this arena its own
// materials so disposing or changing rounds cannot invalidate another scene.
export function createAssetPlacement() {
  const materials = new Map();
  return (parent, model, {at=[0,0,0], scale=1, yaw=0, id=model.name}={}) => {
    const own = material => {
      if (!materials.has(material)) {
        const copy=material.clone();
        copy.onBeforeCompile=material.onBeforeCompile;
        copy.customProgramCacheKey=material.customProgramCacheKey;
        materials.set(material,copy);
      }
      return materials.get(material);
    };
    model.traverse(node=>{
      if(node.material)node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
    });
    model.position.fromArray(at);model.rotation.y=yaw;model.scale.multiplyScalar(scale);
    model.userData.assetId=id;parent.add(model);return model;
  };
}
