// Chapita's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Haz más carreras que el otro equipo antes de que se acaben las entradas.'),
  howTo: [
    loc('Al bate, mira el aro en el plato: otro aro se va cerrando y se pone verde cuando llega la chapita. Batea ahí, en el tercer tic. El palo busca la altura solo.'),
    loc('Donde cae es el batazo: pasar la acera es sencillo, el carro es doble, el poste es triple y por encima de las casas, ¡jonrón!'),
    loc('Si no llega a la acera, es out. Si un pana la atrapa en el aire, también. Fallar una atrapada de cerca es un chapazo… y sale un tuyuyo.'),
  ],
  sections: [{ title: loc('Pitcher'), rows: [
    { action: loc('Planea, cae de golpe o curva'), keyboard: '1 / 2 / 3', gamepad: 'Cruceta + A', touch: loc('Toca el lanzamiento') },
    { action: loc('Apuntar: alto, medio, bajo; izquierda o derecha'), keyboard: loc('Flechas'), gamepad: 'Cruceta + A', touch: loc('Toca la casilla') },
    { action: loc('Hacia dónde rompe la curva'), keyboard: 'Q / E', gamepad: 'LB / RB', touch: loc('Toca el lado') },
    { action: loc('Chapita plana o doblada'), keyboard: 'C', gamepad: 'Y', touch: loc('Toca la chapita') },
    { action: loc('Lanzar'), keyboard: loc('Espacio'), gamepad: 'X / RT', touch: loc('Botón ¡Lanza!') },
  ] }, { title: loc('Al bate y en el campo'), rows: [
    { action: loc('Cambiar la altura del palo (si no, va sola)'), keyboard: loc('W / S / Flechas'), gamepad: 'Cruceta + A', touch: loc('Toca la altura') },
    { action: loc('Batear'), keyboard: loc('Espacio'), gamepad: 'X / RT', touch: loc('Botón ¡Batea!') },
    { action: loc('Atrapar la chapita'), keyboard: loc('Espacio'), gamepad: 'X / RT', touch: loc('Botón ¡Atrápala!') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Batear de zurdo (en la sala)'), keyboard: 'Z', touch: loc('Botón Batear de zurdo') },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Reglas de la casa: con la Ruleta, cada caimanera trae dos al azar. Carro que pasa = tiempo: se para el juego hasta que pase. El que la tire a la azotea, sale: ese jonrón es out. Ventana = out. Zurdos batean doble: el sencillo de un zurdo vale doble.'),
    loc('El cuarto bate tiene más chance. Poncharte dos veces y pegarle a la tercera es un Willy Mays. Los bots de vieja escuela tiran muchas que caen; los de nueva escuela, curvas.'),
  ],
};
