// ¡Stop!'s categories: El Saber's (the game knows their words), the free
// prompts (open answers the table always votes on), Ciudad, estado o país
// (one box, any of the three counts) and the host's own ones ("+Texto").
// Pure data, no DOM: rules.js, the host and Node tests share it.
import { categoryLabel, categoryShort } from '/engine/play/saber-match.js';

export const CLASICAS = ['nombre', 'apellido', 'pais', 'ciudad', 'animal', 'fruta', 'color', 'cosa'];
export const CRIOLLAS = ['estado', 'comida', 'palabra', 'dicho', 'pelotero', 'musica', 'lugar', 'marca', 'carinoso'];
export const VARIADAS = ['profesion', 'deporte', 'cuerpo', 'casa', 'planta', 'pelicula'];
export const SABER_IDS = [...CLASICAS, ...CRIOLLAS, ...VARIADAS];

// One box for three Saber categories.
export const CEP = { id: 'cep', label: 'Ciudad, estado o país', short: 'C / E / P', parts: ['ciudad', 'estado', 'pais'] };

// Free prompts. `words` is what bots may write ("A; B; C"), clean answers
// only; a letter with none leaves the bot's box blank. `criollo` prompts are
// dealt only with Más criollo.
const FREE = [
  // Pa' reírse
  { id: 'nevera', label: 'Lo que hay en la nevera', short: 'Nevera', words: 'Agua; Arepas; Butifarra; Cambur; Cebolla; Chicha; Diablitos; Empanadas; Frescolita; Guasacaca; Huevos; Jamón; Leche; Mantequilla; Mayonesa; Natilla; Nata; Ollas de ayer; Pasta; Pollo; Queso; Refresco; Salsa; Tomate; Uvas; Yogur; Zanahoria' },
  { id: 'cartera', label: 'Lo que cargas en la cartera', short: 'Cartera', words: 'Audífonos; Billetera; Caramelos; Cargador; Cédula; Desodorante; Espejito; Facturas viejas; Gel; Hilo dental; Labial; Llaves; Lentes; Monedas; Maquillaje; Pañitos; Papelitos; Peine; Recibos; Sombrilla; Toallitas; Tapabocas; Vaselina; Zarcillos' },
  { id: 'delito', label: 'Debería ser delito', short: 'Delito', words: 'Agua tibia; Arepa sin relleno; Bañarse con agua fría; Cola en el banco; Comer en el cine con ruido; Despertar temprano el domingo; Dejar en visto; Echar spoiler; Fila del abasto; Gritar en el autobús; Lunes; Llegar tarde; Mandar audios largos; Música a todo volumen; No devolver el táper; Pedir prestado y no pagar; Piña en la pizza; Reunión que pudo ser un correo; Spoilers; Tráfico; Tos en el cine; Volumen alto en el teléfono' },
  { id: 'regalo', label: 'El peor regalo de cumpleaños', short: 'Mal regalo', words: 'Agenda del año pasado; Calcetines; Calculadora; Cepillo de dientes; Desodorante; Escoba; Esponja; Factura; Gorra fea; Libro de dieta; Llavero; Medias; Nada; Pantuflas; Peine; Plancha; Rifa vencida; Suéter de lana; Taza; Tupper; Velas usadas; Vale por un abrazo' },
  { id: 'cita', label: 'Lo que no se hace en la primera cita', short: 'Primera cita', words: 'Arrancar a llorar; Bostezar; Contar el sueldo; Dividir la cuenta en centavos; Eructar; Estar con el teléfono; Hablar de la ex; Hablar de la mamá; Invitar a la suegra; Llegar tarde; Llevar a la mamá; Mentir; Mostrar fotos del perro; Pedir prestado; Proponer matrimonio; Roncar; Salir corriendo; Traer a un pana' },
  { id: 'excusa', label: 'Excusa para llegar tarde', short: 'Excusa', words: 'Accidente; Agua cortada; Autobús lleno; Cola de gasolina; Carro accidentado; Despertador dañado; Dolor de barriga; El gato; El perro se comió las llaves; Faltó la luz; Gandola volteada; Guardia nacional; Lluvia; Llaves perdidas; Metro parado; Me quedé dormido; Neumático espichado; Operativo; Perdí el autobús; Problema familiar; Que me robaron; Tráfico; Una cola horrible' },
  { id: 'suegra', label: 'Mi suegra es…', short: 'Suegra', words: 'Amable; Brava; Bochinchera; Chismosa; Cariñosa; Celosa; Dulce; Echona; Enredadora; Fosforito; Graciosa; Habladora; Intensa; Juiciosa; Linda; Mandona; Metiche; Novelera; Peleona; Pendiente de todo; Regañona; Sabelotodo; Tremenda; Vigilante' },
  { id: 'playa', label: 'Lo que te llevas a la playa', short: 'Playa', words: 'Agua; Arepas; Bronceador; Cava; Cholas; Corneta; Dominó; Empanadas; Flotador; Gorra; Hielo; Lentes de sol; Mantel; Neverita; Pelota; Protector solar; Paraguas; Pareo; Sombrero; Silla; Toalla; Traje de baño; Tobos' },
  { id: 'fiesta', label: 'Canción que acaba con la fiesta', short: 'Mata fiesta', words: 'Ahora te puedes marchar; Baladas tristes; Cumpleaños feliz; Despacito otra vez; El himno; Gaitas en julio; Grito de despedida; La canción del ex; Las mañanitas; Llorando se fue; Música de ascensor; Nana de bebé; Pajarito; Reguetón viejo; Si no te hubieras ido; Tusa' },
  { id: 'sifrino', label: 'Problema de sifrino', short: 'Sifrino', words: 'Agua sin gas; Avión con retraso; Batería del iPhone; Café frío; Cola en el aeropuerto; Delivery tardío; El chofer no llegó; Hotel sin piscina; Internet lento; Jacuzzi frío; Lancha sin gasolina; Mucho sol en la playa; No hay sushi; Perdí el vuelo; Piscina muy fría; Quedarse sin reserva; Sin wifi en el yate; Té sin limón; Vino caliente' },
  { id: 'boda', label: 'En mi boda va a haber', short: 'Mi boda', words: 'Animador; Banda; Baile; Barra libre; Bolsitas de recuerdo; Cachitos; Champaña; Cotillón; Dj; Drama; Fotógrafo; Gaitas; Hora loca; Invitados colados; Llanto; Mariachis; Música; Pasapalos; Pastel; Ponche; Reguetón; Salsa; Tequeños; Tías bailando; Whisky' },
  { id: 'coroto', label: 'Un coroto raro que tengo en la casa', short: 'Coroto raro', words: 'Abanico sin aspas; Bolsa de bolsas; Cable que no sé de qué es; Control de un televisor viejo; Disco de vinilo; Escoba sin palo; Figurita de porcelana; Gato de cerámica; Lámpara de lava; Llave que no abre nada; Muñeca vieja; Nevera vieja; Olla sin tapa; Pote de galletas con costura; Radio de pilas; Silla coja; Taza rota; Teléfono de disco; Velas de cumpleaños' },
  // Confiesa
  { id: 'morirme', label: 'Antes de morirme quiero…', short: 'Antes de morir', words: 'Aprender a nadar; Bailar en la lluvia; Comprar una casa; Conocer Japón; Dar la vuelta al mundo; Escribir un libro; Estudiar; Graduarme; Hacer paracaídas; Ir a la luna; Ir al Salto Ángel; Lanzarme en parapente; Manejar un avión; Nadar con delfines; Pagar mis deudas; Publicar un libro; Ser famoso; Subir el Roraima; Tener un perro; Ver la aurora boreal; Viajar' },
  { id: 'miedo', label: 'Le tengo miedo a…', short: 'Miedo', words: 'Abejas; Alturas; Arañas; Brujas; Cucarachas; Culebras; Dentista; Espíritus; Fantasmas; Gatos negros; Hospitales; Inyecciones; Ladrones; La oscuridad; Mi mamá; Muñecas; Murciélagos; Payasos; Perros; Ratones; Sapos; Tiburones; Truenos; Volar' },
  { id: 'mania', label: 'Una manía rara', short: 'Manía', words: 'Acomodar todo; Abrir la nevera sin hambre; Comerse las uñas; Contar escalones; Dormir con medias; Hablar solo; Lavarse las manos mil veces; Morder el lápiz; Mover la pierna; Ordenar por colores; Oler los libros; Pelar la etiqueta; Revisar la cocina; Silbar; Tararear; Tocar madera' },
  { id: 'risa', label: 'Me da risa…', short: 'Me da risa', words: 'Animales bailando; Bloopers; Caídas; Chistes malos; Cosquillas; Dormir en clase; Estornudos raros; Fotos viejas; Gente cayéndose; Mi abuela; Mi tío borracho; Memes; Niños hablando; Payasos; Perros con ropa; Risas contagiosas; Tropezones; Videos de gatos' },
  { id: 'moda', label: 'La peor moda que usé', short: 'Peor moda', words: 'Bandana; Botas de goma; Bufanda en la playa; Camisa de cuadros; Cejas finitas; Chancletas con medias; Cholas con medias; Copete; Crocs; Flequillo; Gorra de lado; Lentes gigantes; Mechas; Mocasines; Pantalón a la cadera; Pelo pintado; Riñonera; Tirantes; Tubitos' },
  { id: 'piedra', label: 'Lo que me saca la piedra', short: 'Saca la piedra', words: 'Audios largos; Bulla; Cola; Chismes; Despertador; Desorden; Esperar; Facturas; Gente lenta; Gritos; Hipócritas; Impuntualidad; Llamadas de banco; Lunes; Mentiras; Mosquitos; No hay agua; Papeleo; Que me interrumpan; Ronquidos; Spoilers; Tráfico' },
  { id: 'invento', label: 'Un invento loco', short: 'Invento', words: 'Arepa que se rellena sola; Bañera voladora; Cama que te despierta con café; Carro anfibio; Control para la suegra; Despertador que te arrastra; Escoba robot; Filtro de mentiras; Gafas para ver chismes; Helicóptero de bolsillo; Lápiz que hace la tarea; Máquina de tequeños; Nevera que avisa; Paraguas de viento; Puerta a la playa; Ropa que se lava sola; Sombrilla con ventilador; Teletransportador; Zapatos con ruedas' },
  { id: 'marciano', label: 'Qué haces si ves un extraterrestre', short: 'Extraterrestre', words: 'Abrazarlo; Brindarle una arepa; Correr; Darle café; Desmayarme; Esconderme; Filmarlo; Gritar; Hacerme el loco; Invitarlo a la casa; Llamar a mi mamá; Llorar; Mandarle un audio; Pedirle un aventón; Preguntarle el nombre; Rezar; Salir corriendo; Sacarle fotos; Tomarle una selfie; Venderlo' },
  // Inventa
  { id: 'hashtag', label: 'Un hashtag inventado', short: 'Hashtag', words: 'Arepazo; Bochinche total; Cero estrés; Chamo feliz; Domingo de playa; Echando broma; Felices los tres; Gozadera; Hoy no se cocina; Lunes de flojera; Llueve y no hay luz; Mi pana bello; Nadie me para; Plaza y café; Que viva el queso; Rumbita; Sin cola no hay paraíso; Tequeño lover; Vamos con todo' },
  { id: 'eslogan', label: 'Eslogan de un producto', short: 'Eslogan', words: 'Aquí sí hay; Bueno, bonito y barato; Calidad de verdad; Con todo el sabor; Dale que sí; El que lo prueba repite; Fresco como tú; Gózalo; Hecho con cariño; Más rico imposible; Nada como esto; Para toda la familia; Que no te lo cuenten; Rico hasta el final; Sabor criollo; Todo bien; Vívelo' },
  { id: 'reality', label: 'Nombre de un reality show', short: 'Reality', words: 'Amor en la cola; Buscando suegra; Casa de locos; Chamos al poder; Desafío en los Andes; El último tequeño; Familia al rojo vivo; Gran hermano criollo; La isla de los panas; Los Bochincheros; Mi novio es pelotero; Náufragos en Margarita; Operación arepa; Peleas en el edificio; Quién se queda; Rumba en la casa; Sobreviviendo en Caracas; Tías al ataque; Vecinos peleones' },
  { id: 'banda', label: 'Mi banda se llama…', short: 'Mi banda', words: 'Arepa eléctrica; Bananas Furiosas; Cachapa Rock; Chigüires Locos; Dinamita; El Tren; Fuego Lento; Gatos Rabiosos; Hielo Negro; Los Increíbles; Los Pavos; Mango Bajito; Noche de Gaita; Pana Rock; Queso de Mano; Rayos y Truenos; Sapos Bailarines; Tequeños Salvajes; Vinotinto; Zancudos' },
  { id: 'pareja', label: 'Apodo de pareja', short: 'Apodo', words: 'Amorcito; Bebé; Bombón; Cariño; Cielo; Corazón; Cuchi; Dulzura; Flaco; Gordo; Gordi; Mi amor; Mi rey; Mi vida; Muñeca; Negro; Osito; Papi; Princesa; Reina; Tesoro; Terroncito; Vida mía' },
  { id: 'isla', label: 'Nombre de una isla desierta', short: 'Isla', words: 'Arenita; Bahía Perdida; Cayo Flojera; Cayo Sol; Coco Loco; Delfín Feliz; Escondite; Fin del Mundo; Gaviota; Isla Bonita; Isla Tortuga; Lejanía; Mango Verde; Náufrago; Olvido; Palmeras; Paraíso; Rincón del Sol; Sirena; Tesoro; Tranquilidad; Viento Bravo' },
  { id: 'unas', label: 'Color de uñas (no vale el básico)', short: 'Uñas', words: 'Aguamarina; Berenjena; Borgoña; Cereza; Champaña; Chocolate; Coral; Durazno; Esmeralda; Fucsia; Lavanda; Lila; Magenta; Mostaza; Nácar; Ocre; Perla; Plata; Rosa chicle; Salmón; Turquesa; Uva; Vinotinto' },
  { id: 'comiquita', label: 'Comiquita que no existe', short: 'Comiquita', words: 'Aventuras de un tequeño; Bombero Chigüire; Capitán Arepa; Cachicamo Veloz; Detective Morrocoy; El Perro Espacial; Ferdinando el Loro; Gatos del Ávila; Hormiga Ninja; Iguana Mágica; Los Patos Locos; Mono Pirata; Niña del Llano; Oso Frontino; Perico Héroe; Robot Cotufa; Súper Sapo; Tigre Pelotero; Vaca Voladora' },
  { id: 'novela', label: 'Título de telenovela', short: 'Telenovela', words: 'Amor en Mérida; Besos robados; Corazón salvaje; Cuando llora el llano; Destino de mujer; El hijo del jardinero; Engaño de amor; Fuego en la sangre; Gata salvaje; Herencia maldita; Inocencia perdida; La dueña; La heredera; Lágrimas de mar; Mi amor imposible; Morena clara; Niña bonita; Pasión y venganza; Rosa de mayo; Secretos del pasado; Traición; Volver a amar' },
  { id: 'libro', label: 'Título de mi libro', short: 'Mi libro', words: 'Andanzas de un pana; Brincando charcos; Cómo sobrevivir al lunes; Crónicas de la cola; Diario de un flojo; El arte de llegar tarde; Fe y arepas; Gente de mi barrio; Historias del abasto; Instrucciones para no hacer nada; La vida es un bochinche; Memorias de un tequeño; Nunca digas nunca; Otra vez lunes; Pasos de mi abuela; Qué vaina; Recetas de la tía; Sin luz y sin agua; Todo pasa; Viaje al Ávila' },
  // Pa' los chamos
  { id: 'juguete', label: 'Juguete', short: 'Juguete', words: 'Avión; Balón; Barbie; Bicicleta; Carrito; Cometa; Consola; Dominó; Erizo de goma; Furruco; Gurrufío; Hula hula; Lego; Muñeca; Metras; Osito de peluche; Patineta; Perinola; Pelota; Rompecabezas; Robot; Trompo; Yoyo' },
  { id: 'chucheria', label: 'Dulce o chuchería', short: 'Chuchería', words: 'Algodón de azúcar; Bombón; Barquilla; Caramelo; Chupeta; Chocolate; Cocosete; Cotufas; Dandy; Doritos; Galleta; Gomitas; Helado; Jalea; Majarete; Malta; Marquesa; Natilla; Pirulín; Pepitos; Raquety; Susy; Torta; Tostón' },
  { id: 'personaje', label: 'Personaje de comiquita', short: 'Personaje', words: 'Aladino; Bob Esponja; Batman; Bugs Bunny; Cenicienta; Doraemon; Elsa; Gokú; Garfield; Homero; Jerry; Kitty; Mickey; Minnie; Naruto; Olaf; Patricio; Pikachu; Pinocho; Popeye; Rapunzel; Scooby; Shrek; Simba; Tom; Woody' },
  { id: 'famoso', label: 'Famoso o famosa', short: 'Famoso', words: 'Bad Bunny; Beyoncé; Carlos Baute; Chyno; Daddy Yankee; Edgar Ramírez; Karol G; Lele Pons; Messi; Nacho; Oscar D\'León; Ricky Martin; Rihanna; Shakira; Sheryl Rubio; Taylor Swift; Wilmer Valderrama' },
  // Only with Más criollo
  { id: 'muerte', label: 'Una muerte absurda', short: 'Muerte absurda', criollo: true, words: 'Ahogado en un tobo; Atragantado con una hallaca; Cayéndose de la hamaca; Comiendo cotufas; Del susto; De risa; Electrocutado con la nevera; Golpe con un coco; Infarto en la cola; Mordido por un chigüire; Pisando una metra; Resbalón en la ducha; Tropezando con el gato' },
  { id: 'divorcio', label: 'Motivo de divorcio', short: 'Divorcio', criollo: true, words: 'Celos; Chismes; Deudas; Dejar los platos sucios; Ex novia; Flojera; Gastar mucho; La suegra; Mentiras; No bajar la tapa; Roncar; Ser tacaño; Tener otra; Videojuegos' },
];

export const FREE_PROMPTS = Object.freeze(FREE.map(p => Object.freeze({ ...p, criollo: !!p.criollo, words: Object.freeze(p.words.split(';').map(w => w.trim()).filter(Boolean)) })));
const FREE_BY_ID = Object.fromEntries(FREE_PROMPTS.map(p => [p.id, p]));
const REIRSE = ['nevera', 'cartera', 'delito', 'regalo', 'cita', 'excusa', 'suegra', 'playa', 'fiesta', 'sifrino', 'boda', 'coroto', 'muerte', 'divorcio'];
const CONFIESA = ['morirme', 'miedo', 'mania', 'risa', 'moda', 'piedra', 'invento', 'marciano'];
const INVENTA = ['hashtag', 'eslogan', 'reality', 'banda', 'pareja', 'isla', 'unas', 'comiquita', 'novela', 'libro'];

// Packs: `deal` is the pack's own list (shuffled unless `fixed`), then
// `fill` tops it up to the table's count. Mezcla and Al azar keep their
// own dealing in rules.js.
export const PACKS = [
  { id: 'clasicas', name: 'Clásicas', note: 'Nombre, apellido, país, animal, color… la de toda la vida.', deal: CLASICAS, fixed: true, fill: CRIOLLAS },
  { id: 'criollas', name: 'Criollas', note: 'Estados, comida, dichos, peloteros y palabras de aquí.', deal: CRIOLLAS, fill: CLASICAS },
  { id: 'variadas', name: 'Variadas', note: 'Profesión, deporte, cuerpo, casa, planta y película.', deal: VARIADAS, fill: CLASICAS },
  { id: 'chamos', name: "Pa' los chamos", note: 'Para jugar con los niños: juguetes, chucherías y comiquitas.', deal: ['nombre', 'animal', 'fruta', 'color', 'cep', 'juguete', 'chucheria', 'personaje', 'casa', 'deporte'], fill: ['cuerpo', 'cosa'] },
  { id: 'geografia', name: 'Geografía', note: 'Países, ciudades, estados y lugares de Venezuela.', deal: ['cep', 'pais', 'ciudad', 'estado', 'lugar', 'animal', 'planta', 'comida', 'fruta', 'nombre'], fill: CLASICAS },
  { id: 'farandula', name: 'Farándula', note: 'Música, películas, marcas, peloteros y famosos.', deal: ['musica', 'pelicula', 'marca', 'pelotero', 'famoso', 'personaje', 'nombre', 'apellido', 'deporte', 'profesion'], fill: CLASICAS },
  { id: 'reirse', name: "Pa' reírse", note: 'Nada de respuestas correctas: la mesa vota todo. Gana el más ocurrido.', deal: REIRSE, fill: CONFIESA },
  { id: 'confiesa', name: 'Confiesa', note: 'Miedos, manías y sueños: aquí se conoce a la gente.', deal: CONFIESA, fill: REIRSE },
  { id: 'inventa', name: 'Inventa', note: 'Hashtags, telenovelas, bandas y apodos que todavía no existen.', deal: INVENTA, fill: REIRSE },
  { id: 'mezcla', name: 'Mezcla', note: 'Una clásica, una criolla, una variada… y así.' },
  { id: 'azar', name: 'Al azar', note: 'Cualquiera de las categorías que la libreta conoce.' },
];
export const packOf = (id) => PACKS.find(p => p.id === id) || PACKS[0];

// Own categories travel as "+Texto": short, single-spaced text.
export const CUSTOM_MAX = 3, CUSTOM_LENGTH = 28;
export const isCustom = (id) => typeof id === 'string' && id.startsWith('+');
export const customId = (text) => `+${text}`;

// saber (dictionary), cep (three dictionaries), libre (always voted) or propia (host's own).
export function kindOf(id) {
  if (isCustom(id)) return 'propia';
  if (id === CEP.id) return 'cep';
  if (FREE_BY_ID[id]) return 'libre';
  return 'saber';
}
export const freePrompt = (id) => FREE_BY_ID[id] || null;
export const isFree = (id) => !!FREE_BY_ID[id];
export function label(id) {
  if (isCustom(id)) return id.slice(1);
  if (id === CEP.id) return CEP.label;
  return FREE_BY_ID[id]?.label || categoryLabel(id);
}
export function short(id) {
  if (isCustom(id)) return id.slice(1);
  if (id === CEP.id) return CEP.short;
  return FREE_BY_ID[id]?.short || categoryShort(id);
}
// The categories a list deals at this table, in order: criollo prompts only
// with Más criollo, and Ciudad, estado o país never beside one of its parts
// (with `cep` on, it replaces them).
export function arrange(list, options) {
  const out = [];
  for (const raw of list) {
    const id = options.cep && CEP.parts.includes(raw) ? CEP.id : raw;
    if (out.includes(id) || (FREE_BY_ID[id]?.criollo && !options.criollo)) continue;
    if (id === CEP.id ? out.some(x => CEP.parts.includes(x)) : CEP.parts.includes(id) && out.includes(CEP.id)) continue;
    out.push(id);
  }
  return out;
}

// Categories whose accepted words a browser may keep for the next table
// (never the host's own: they mean something only at this table).
export const REMEMBERED = [...SABER_IDS, CEP.id, ...FREE_PROMPTS.map(p => p.id)];
