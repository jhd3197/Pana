export const CAMINO = ['highfive','slip','rollbarrel','moonwalk','spring','dodge','piggy','umbrella','tunnel','gum'];
export const MOTION_NAMES = ['Chócala','Resbalón','Rodar','Moonwalk','Resorte','Esquivar','Caballito','Paraguas','Túnel','Chicle'];

// Cosmetic selection consumes no game RNG and is identical on every client.
// Partner tricks require a real stationary pawn along the awarded path.
export function chooseMotion({rng,revision,seat,piece,steps,friend=false,rival=false,capture=false}) {
  if (steps < 3 || capture) return 'hop';
  const available = CAMINO.filter(id => id==='highfive'||id==='piggy' ? friend : id==='dodge' ? rival : true);
  let hash = ((rng>>>0) ^ Math.imul(revision+1,2654435761) ^ (seat*4+piece)*97)>>>0;
  hash = Math.imul(hash ^ hash>>>16, 0x45d9f3b);
  hash = Math.imul(hash ^ hash>>>16, 0x45d9f3b);
  return available[((hash ^ hash>>>16)>>>0)%available.length];
}
