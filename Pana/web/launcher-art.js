// Supplied launcher illustrations. IDs and rules still come from game.json.
export const categories = ['Todos', 'Carreras', 'Mesa', 'Fiesta', 'Aventura'];
export const artwork = {
  derrape: ['Carreras', 'derrape.jpg'], galope: ['Carreras', 'galope.jpg'], curiara: ['Carreras', 'curiara.jpg'],
  domino: ['Mesa', 'domino.jpg'], caida: ['Mesa', 'caida.jpg'], poquer: ['Mesa', 'poquer.jpg'], billar: ['Mesa', 'billar.jpg'],
  ludo: ['Mesa', 'ludo.jpg', 'ludo-card.jpg'], criollas: ['Mesa', 'criollas.jpg', 'criollas-card.jpg'], qqsmp: ['Mesa', 'qqsmp.jpg', 'qqsmp-card.jpg'], bululu: ['Fiesta', 'bululu.jpg'], cocina: ['Fiesta', 'cocina.jpg'],
  escondidas: ['Fiesta', 'escondidas.jpg'], pintura: ['Fiesta', 'pintura.jpg'], tambor: ['Fiesta', 'tambor.jpg', 'tambor-card.jpg'],
  embuste: ['Aventura', 'embuste.jpg'], reliquia: ['Aventura', 'reliquia.jpg'],
};
export const category = game => artwork[game.id]?.[0] || 'Fiesta';
export const artUrl = (game, card = false) => {
  const art = artwork[game.id];
  const file = (card && art?.[2]) || art?.[1];
  return file ? new URL(`./images/launcher/${file}`, import.meta.url).href : null;
};
