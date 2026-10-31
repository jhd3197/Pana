// Let the browser present the new status before doing the next construction
// step. Also works when requestAnimationFrame is throttled in a hidden tab.
export function paintNext() {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() => setTimeout(() => { clearTimeout(fallback); resolve(); }, 0));
  });
}

// Loading-screen tips: real rules only.
import { ITEM_ICONS } from './item-art.js';
import { ICONS as SVG } from '/engine/icons.js';
import { loc } from '/engine/i18n.js';
export const TIPS = [
  [SVG.mango, loc('Lleva un mango equipado: bloquea el mango que te lancen.')],
  [SVG.coin, loc('Cada moneda te da un poquito más de velocidad, hasta 10.')],
  [SVG.crate, loc('Rompe cajas de madera para conseguir objetos. Guardas hasta 2.')],
  [SVG.juice, loc('El jugo de mango te da un turbo: tómatelo en una recta.')],
  [SVG.back, loc('Lanza un objeto hacia atrás para frenar al que te persigue.')],
  [ITEM_ICONS.drift, loc('Mantén el botón de derrape y gira: la ayuda suaviza la curva. Suéltalo para salir con turbo.')],
  [ITEM_ICONS.drift, loc('En una rampa, pulsa el botón de derrape en el aire para hacer un truco y caer con turbo.')],
  [ITEM_ICONS.cohete, loc('El cohete persigue al carro que va justo delante de ti.')],
  [ITEM_ICONS.chancleta, loc('La chancleta vuela por encima de la pista y cae sobre el líder.')],
  [ITEM_ICONS.totuma, loc('La totuma protectora aguanta un golpe de lo que sea.')],
  [ITEM_ICONS.aguacero, loc('El aguacero moja a todos tus rivales durante 5 segundos; potenciado dura 7,5.')],
  [ITEM_ICONS.trampa, loc('Ojo con las cajas con banda roja: son trampas y explotan.')],
  [SVG.coin, loc('Con 10 monedas tu próximo objeto sale potenciado.')],
  [SVG.back, loc('¿Atascado o te caíste? Pide un rescate y el zamuro te devuelve a la pista.')],
  [ITEM_ICONS.aguacero, loc('En Pana Selva y Pana Páramo llueve: con cauchos de lluvia no resbalas.')],
  [SVG.crate, loc('Busca los puentes de tablas: son atajos, pero sin turbo frenan y sin baranda te puedes caer.')],
  [SVG.coin, loc('Pégate detrás de otro carro en la recta: el rebufo te lanza hacia adelante.')],
  [SVG.coin, loc('Si te pegan pierdes monedas. Cuídalas: cada una es velocidad.')],
];
