// Supplied launcher illustrations. IDs and rules still come from game.json.
export const categories = ['Todos', 'Carreras', 'Mesa', 'Fiesta', 'Aventura'];
export const artwork = {
  derrape: ['Carreras', 'derrape.jpg'], galope: ['Carreras', 'galope.jpg'], curiara: ['Carreras', 'curiara.jpg'],
  domino: ['Mesa', 'domino.jpg'], caida: ['Mesa', 'caida.jpg'], poquer: ['Mesa', 'poquer.jpg'], billar: ['Mesa', 'billar.jpg'],
  criollas: ['Mesa', null], bululu: ['Fiesta', 'bululu.jpg'], cocina: ['Fiesta', 'cocina.jpg'],
  escondidas: ['Fiesta', 'escondidas.jpg'], pintura: ['Fiesta', 'pintura.jpg'],
  embuste: ['Aventura', 'embuste.png'], reliquia: ['Aventura', 'reliquia.jpg'],
};
export const category = game => artwork[game.id]?.[0] || 'Fiesta';
export const artUrl = game => artwork[game.id]?.[1] ? new URL(`./images/launcher/${artwork[game.id][1]}`, import.meta.url).href : null;
