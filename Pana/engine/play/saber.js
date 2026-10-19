// El Saber: shared Venezuelan knowledge that several games read (¡Stop!
// validates answers and gives bots theirs; QQSMP can build questions from it).
// Pure data, no DOM: rules files and Node tests import it. The lookup,
// normalize and fuzzy-match API lives in engine/play/saber-match.js.
//
// Each entry is { category, word, variants, explain, source, crude, doubtful, joke }:
// - variants: other accepted spellings or short forms (accents never matter).
// - explain: a short explanation shown in reviews ("tacaño, no suelta ni un
//   bolívar"), '' when the word explains itself.
// - source: 'pana' (curated list) or the reel ID it came from.
// - crude: only valid when a table opts into "más criollo".
// - doubtful: the game knows the word but the table must vote on it (Nemo as
//   an animal, Hormiga as a color). joke: a named gag ('oreo').
//
// The lists below use one compact line format so they stay easy to grow:
//   Word/Variant/Variant #crude #duda #oreo @REELID = explanation
// Entries are separated by newlines or ';'. Tags and explanation are optional.

export const SABER_CATEGORIES = {
  nombre: { label: 'Nombre', short: 'Nombre' },
  apellido: { label: 'Apellido', short: 'Apellido' },
  pais: { label: 'País', short: 'País' },
  ciudad: { label: 'Ciudad', short: 'Ciudad' },
  animal: { label: 'Animal', short: 'Animal' },
  fruta: { label: 'Fruta', short: 'Fruta' },
  color: { label: 'Color', short: 'Color' },
  cosa: { label: 'Cosa', short: 'Cosa' },
  estado: { label: 'Estado de Venezuela', short: 'Estado' },
  comida: { label: 'Comida criolla', short: 'Comida' },
  palabra: { label: 'Palabra venezolana', short: 'Palabra' },
  dicho: { label: 'Dicho', short: 'Dicho' },
  pelotero: { label: 'Pelotero venezolano', short: 'Pelotero' },
  musica: { label: 'Cantante o canción venezolana', short: 'Música' },
  lugar: { label: 'Lugar de Venezuela', short: 'Lugar' },
  marca: { label: 'Marca', short: 'Marca' },
  carinoso: { label: 'Insulto cariñoso', short: 'Cariñoso' },
};

const REEL = 'C4B9Vk6L9kK';

const RAW = {
  nombre: `
Abigail; Adriana; Alberto; Alejandra; Alejandro; Alexander; Alicia; Ana; Andrea; Andrés @${REEL}; Ángel; Ángela; Antonio; Armando; Arturo
Beatriz; Benito; Bernardo; Betania; Brenda; Bruno; Belkis; Blanca
Camila; Carla; Carlos; Carmen; Carolina; César; Cristina; Claudia; Cheo = así le dicen a los José; Coromoto = por la Virgen de Coromoto, patrona de Venezuela
Daniel; Daniela; David; Diana; Diego; Dayana; Domingo; Dulce
Eduardo; Elena; Elías; Emilio; Enrique; Ernesto; Esteban; Eva; Elizabeth; Emily; Eglé
Fabiola; Federico; Felipe; Fernanda; Fernando; Francisco; Freddy; Francys
Gabriel; Gabriela; Gerardo; Gilberto; Gloria; Gonzalo; Gregorio; Guillermo; Gustavo; Génesis
Héctor; Helena; Hernán; Hilda; Hugo; Humberto; Heidy
Ignacio; Inés; Irene; Isabel; Isaac; Iván; Ivonne; Ismael; Iris
Jaime; Javier; Jesús; Joaquín; Jorge; José; Josefina; Juan; Juana; Julia; Julio; Jhonny/Johnny; Jeniffer/Jennifer
Karen; Karina; Karla; Katherine; Kevin; Keila; Kelvin
Laura; Leonardo; Lorena; Lourdes; Lucía; Luis; Luisa; Lisbeth; Leidy; Lissette
Manuel; Marcos; Margarita; María; Mariana; Mario; Marta; Martín; Mercedes; Miguel; Milagros; Mónica
Natalia; Nelson; Nicolás; Noemí; Norma; Nancy; Néstor; Nathaly
Óscar; Olga; Omar; Orlando; Octavio; Ofelia; Oriana
Pablo; Patricia; Paula; Pedro; Pilar; Pascual; Petra
Rafael; Ramón; Raúl; Rebeca; Ricardo; Roberto; Rocío; Rosa; Rosario; Rubén
Samuel; Sandra; Santiago; Sara; Sergio; Silvia; Simón; Sofía; Susana
Tatiana; Teresa; Tomás; Tito; Toño = así le dicen a los Antonio
Úrsula; Ulises; Ubaldo; Urbano
Valentina; Valeria; Verónica; Vicente; Víctor; Virginia; Vanessa
Wilmer; Wilfredo; Walter; Wendy; Wuilliams/Williams; Wiston/Winston
Xiomara; Ximena; Xavier
Yolanda; Yusmary; Yorman; Yuleisy; Yesenia; Yonaiker; Yaneth
Zulay; Zoraida; Zoe; Zacarías
?Iron Man/Ironman @${REEL} = es un superhéroe, no un nombre
`,
  apellido: `
Acosta; Aguilar; Álvarez; Aponte; Arias; Avendaño; Azuaje; Alvarado; Aranguren
Barrios; Bello; Betancourt; Blanco; Bolívar; Borges; Briceño; Brito; Bastidas
Cabrera; Calderón; Camacho; Cárdenas; Castillo; Castro; Colmenares; Contreras; Córdova; Chirinos
Delgado; Díaz; Domínguez; Duarte; Dávila
Echeverría; Escalante; Escobar; Espinoza; Estrada; Esté
Fajardo; Fernández; Figueroa; Flores; Fuentes; Fermín
Gallardo; García; Gil; Gómez; González; Graterol; Guerrero; Gutiérrez; Guevara
Hernández; Herrera; Hidalgo; Hurtado; Henríquez
Ibarra; Infante; Iriarte; Istúriz
Jiménez; Jaimes; Jáuregui; Jordán
Key; Kauffman
Lara; León; Linares; López; Lugo; Luna; Lozada
Machado; Maldonado; Marcano; Márquez; Martínez; Medina; Mendoza; Montilla; Morales; Moreno; Mujica
Navarro; Nieves; Noguera; Núñez; Natera
Ochoa; Olivares; Ortega; Ortiz; Osorio; Oropeza
Pacheco; Padilla; Palacios; Paredes; Peña; Pérez; Pineda; Piñango; Prieto
Quintero; Quiñones; Quevedo; Quijada
Ramírez; Ramos; Rangel; Rivas; Rivero; Rodríguez; Rojas; Romero; Rondón; Ruiz
Salazar; Sánchez; Silva; Sosa; Suárez; Sandoval; Sequera
Toro; Torres; Tovar; Trujillo; Torrealba
Urdaneta; Uzcátegui; Urbina; Ugarte
Valero; Vargas; Vásquez; Velásquez; Villegas; Villalobos; Vivas
Wallis; Weffer
Ximénez
Yépez; Yánez
Zambrano; Zerpa; Zamora; Zapata
`,
  pais: `
Afganistán; Albania; Alemania; Andorra; Angola; Arabia Saudita; Argelia; Argentina; Armenia; Australia; Austria; Azerbaiyán
Bahamas; Bangladés; Barbados; Baréin; Bélgica; Belice; Benín; Bielorrusia; Bolivia; Bosnia; Botsuana; Brasil; Brunéi; Bulgaria; Burkina Faso; Bután
Cabo Verde; Camboya; Camerún; Canadá; Chad; Chile; China; Chipre; Colombia; Comoras; Congo; Corea del Sur/Corea; Corea del Norte; Costa Rica; Costa de Marfil; Croacia; Cuba
Dinamarca; Dominica
Ecuador; Egipto; El Salvador; Emiratos Árabes Unidos/Emiratos; Eritrea; Eslovaquia; Eslovenia; España; Estados Unidos/USA; Estonia; Etiopía; Escocia
Filipinas; Finlandia; Fiyi; Francia
Gabón; Gambia; Georgia; Ghana; Granada; Grecia; Guatemala; Guinea; Guyana; Gales
Haití; Honduras; Hungría; Holanda/Países Bajos
India; Indonesia; Irak; Irán; Irlanda; Islandia; Israel; Italia; Inglaterra
Jamaica; Japón; Jordania
Kazajistán; Kenia; Kirguistán; Kuwait; Kosovo
Laos; Lesoto; Letonia; Líbano; Liberia; Libia; Liechtenstein; Lituania; Luxemburgo
Madagascar; Malasia; Malaui; Maldivas; Malí; Malta; Marruecos; Mauricio; Mauritania; México; Moldavia; Mónaco; Mongolia; Montenegro; Mozambique
Namibia; Nepal; Nicaragua; Níger; Nigeria; Noruega; Nueva Zelanda
Omán
Pakistán; Panamá; Paraguay; Perú; Polonia; Portugal; Papúa Nueva Guinea
Qatar/Catar
Reino Unido; República Dominicana; Rumania; Rusia; Ruanda
Samoa; San Marino; Senegal; Serbia; Singapur; Siria; Somalia; Sri Lanka; Sudáfrica; Sudán; Suecia; Suiza; Surinam
Tailandia; Tanzania; Togo; Trinidad y Tobago/Trinidad; Túnez; Turquía; Taiwán
Ucrania; Uganda; Uruguay; Uzbekistán
Vanuatu; Vaticano; Venezuela; Vietnam
Yemen; Yibuti
Zambia; Zimbabue
?Puerto Rico = estado libre asociado, en unas libretas cuenta y en otras no
`,
  ciudad: `
Acarigua; Anaco; Araure; Altagracia de Orituco; Atenas; Ámsterdam; Asunción; Abu Dabi; Acapulco; Alicante
Barquisimeto; Barcelona; Barinas; Biscucuy; Bogotá; Buenos Aires; Berlín; Bilbao; Bruselas; Boston; Brasilia
Caracas @${REEL}; Cabimas; Calabozo; Carúpano; Carora; Coro; Cumaná; Ciudad Bolívar; Ciudad Guayana; Cagua; Charallave; Cúa; Chicago; Cali; Cartagena; Córdoba
Duaca; Dubái; Dublín; Detroit; Denver
Ejido; El Tigre; El Vigía; El Tocuyo/Tocuyo; Estambul; Edimburgo; El Cairo/Cairo
Florencia; Frankfurt; Filadelfia
Guanare; Guarenas; Guatire; Guasdualito; Güiria; Ginebra; Guadalajara; Guayaquil; Glasgow
Higuerote; Houston; Hamburgo; Helsinki; Hong Kong
Isla de Toas; Ibiza; Iquitos
Jusepín; Jerusalén; Johannesburgo
Kavanayén; Kioto; Kiev
La Asunción; Los Teques; La Victoria; Lechería; Lima; Londres; Lisboa; Los Ángeles; Liverpool
Maracaibo; Maracay; Maturín; Mérida; Machiques; Mariara; Madrid; Miami; Medellín; Moscú; Montevideo; Milán; Múnich; Manchester
Nirgua; Nueva York; Nápoles; Niza
Ocumare del Tuy; Orlando; Oslo; Ottawa; Oporto
Puerto La Cruz; Punto Fijo; Puerto Ayacucho; Puerto Cabello; Porlamar; Petare; Palo Negro; París; Panamá; Praga; Pekín
Quíbor; Quito; Quebec
Rubio; Roma; Río de Janeiro; Rosario
San Cristóbal; San Fernando de Apure; San Juan de los Morros; San Carlos; San Felipe; Santa Bárbara; Santiago; Sevilla; Sídney; São Paulo; San Francisco; Santo Domingo
Tucupita; Trujillo; Turmero; Táriba; Tinaquillo; Tokio; Toronto; Turín; Toledo
Upata; Ureña; Utrecht
Valencia; Valera; Valle de la Pascua; Villa de Cura; Viena; Venecia; Varsovia; Vancouver
Washington
Yaritagua; York
Zaraza; Zúrich; Zaragoza
?Carinas @${REEL} = suena a Barinas, porque Caracas es Caracas y lo demás es monte y culebra
`,
  animal: `
Abeja; Águila; Alacrán; Anaconda; Ardilla; Araguato = mono aullador de los llanos; Armadillo; Avestruz; Avispa; Alpaca; Anguila
Ballena; Babo = la babilla, primo chiquito del caimán; Báquiro = cochino de monte; Búfalo; Burro; Búho; Bagre; Becerro
Caballo; Cabra; Cachicamo = armadillo en criollo; Caimán; Camello; Canguro; Cangrejo; Caracol; Chigüire = el roedor más grande del mundo, vive en los llanos; Chivo; Cochino; Cocodrilo; Colibrí; Conejo; Cucaracha; Cunaguaro = gato montés venezolano; Culebra; Cóndor; Corocora = ave roja de los llanos; Camarón
Danta = el tapir; Delfín; Dromedario; Dinosaurio
Elefante; Erizo; Escorpión; Escarabajo; Esturión
Foca; Flamenco; Faisán
Gallina; Gallo; Ganso; Garza; Gato; Gavilán; Guacamaya; Gusano; Gorila; Guácharo = pájaro nocturno de la cueva de Caripe; Grillo
Hipopótamo; Hormiga; Hurón; Hiena; Halcón; Hámster
Iguana; Impala
Jaguar; Jabalí; Jirafa; Jaiba
Koala; Kiwi
Langosta; Lapa = roedor grande de monte; León; Leopardo; Lombriz; Loro; Lobo; Lagartija; Llama; Lechuza
Mapurite = el zorrillo, huele horrible; Mono; Morrocoy = tortuga de patas rojas; Mosca; Murciélago; Mariposa; Manatí; Mapache; Medusa; Mula
Nutria @${REEL}; Narval
Oso; Oveja; Ostra; Orca; Oruga; Oso hormiguero; Ocelote
Paloma; Pato; Pavo; Perico; Perro; Picure = roedor de monte, como una lapa flaca; Puma; Pulpo; Pingüino; Pez; Pájaro; Pantera; Piraña; Puercoespín; Pereza
Rana; Ratón; Rinoceronte; Raya; Rata; Reno
Sapo; Serpiente; Sardina; Salamandra; Saltamontes
Tigre; Tiburón; Tortuga; Tucán; Turpial = el ave nacional de Venezuela; Toro; Tapir; Tarántula; Tejón; Topo
Urraca; Unau = el perezoso de dos dedos
Vaca; Venado; Víbora; Vicuña
Yegua; Yak
Zamuro = el zopilote; Zorro; Zancudo = el mosquito; Zarigüeya; Cebra
?Nemo @${REEL} = es un pez payaso… de película. ¡Ya te estás abusando!
?Dumbo @${REEL} = es un elefante… de Disney
?Bambi = es un venado… de película
?Simba = es un león… de película
?Pikachu = es un Pokémon
`,
  fruta: `
Aguacate; Albaricoque; Arándano; Anón = fruta dulce de pulpa blanca
Banana; Badea = como una parchita gigante
Cambur = el plátano dulce, la banana; Caimito = fruta morada de pulpa lechosa; Cereza; Chirimoya; Ciruela; Coco; Corozo = palmita roja de jugo agrio; Cotoperiz = frutica verde de cáscara dura; Cereza de Barbados/Semeruco
Durazno; Dátil
Frambuesa; Fresa
Granada; Guanábana; Guayaba; Guama = vaina con pulpa blanca algodonosa; Grosella
Higo
Icaco = frutica de playa, se come en dulce
Jobo = frutica amarilla agridulce
Kiwi; Kumquat
Lechosa = la papaya; Limón; Lima; Lulo
Mamón = se chupa la semilla; Mandarina; Mango; Manzana; Maracuyá/Parchita; Melón; Mora; Mamey; Merey = el marañón, la fruta del cajú; Mangostán
Naranja; Níspero; Nectarina
Onoto = semilla roja que pinta la hallaca
Parchita = el maracuyá; Patilla = la sandía; Pera; Piña; Pomarrosa = huele a rosa; Pitahaya; Plátano; Pumalaca = manzana de agua roja
Quinotos
Rambután
Sandía; Semeruco = cereza criolla; Sarrapia
Tamarindo; Toronja; Tuna; Tomate de árbol
Uva; Uva de playa
Zapote; Zarzamora
`,
  color: `
Amarillo; Azul; Anaranjado; Añil; Ámbar; Aguamarina; Azul rey; Arena
Blanco; Beige; Borgoña; Bronce; Burdeos
Café; Celeste; Carmesí; Cian; Coral; Crema; Chocolate; Canela; Caqui; Champaña; Ceniza; Cobre
Dorado; Durazno
Esmeralda; Escarlata
Fucsia
Gris; Granate; Grana
Hueso; Hielo
Índigo
Jade
Kaki
Lila; Lavanda; Lima; Limón
Marrón; Morado; Magenta; Mostaza; Marfil; Mamey = el anaranjado rosado del mamey; Malva; Menta
Negro; Naranja; Nácar
Ocre; Oliva; Oro
Plateado; Púrpura; Plomo = el gris en Venezuela; Perla; Palo de rosa; Pistacho
Rojo; Rosado; Rosa; Rubí
Salmón; Sepia
Turquesa; Terracota; Tornasol; Tinto
Uva
Verde; Violeta; Vinotinto = el color de la selección de Venezuela
Zafiro
?Hormiga/Color de hormiga @${REEL} = "la cosa se está poniendo color de hormiga": se está poniendo fea
?Oreo #oreo @${REEL} = negro y blanco, dos colores en uno
`,
  cosa: `
Abanico; Aguja; Almohada; Anillo; Arepera = la maquinita de hacer arepas; Alfombra; Avión; Agenda
Balde; Bombillo; Botella; Budare = la plancha redonda de las arepas; Bicicleta; Billetera; Bolígrafo; Bolso; Borrador; Banco
Cama; Chinchorro = la hamaca tejida; Cuaderno; Cuchara; Cuchillo; Coroto = cualquier cosa, un perol; Cuatro = la guitarrita de cuatro cuerdas; Cepillo; Computadora; Cartera; Cobija; Cometa = el papagayo; Chola = la chancleta; Collar
Dado; Disco; Destornillador; Delantal
Escoba; Espejo; Escalera; Estufa; Escritorio; Esponja
Florero; Fósforo; Franela = la camiseta; Foco; Flauta
Guitarra; Gorra; Grapadora; Globo; Gafas
Hamaca; Hilo; Horno; Hacha
Imán; Impresora; Inodoro
Jarra; Juguete; Jabón; Jaula
Kayak
Lápiz; Lámpara; Libro; Llave; Lentes; Linterna; Licuadora
Maleta; Martillo; Mesa; Maraca; Mochila; Media; Moneda; Metra = la canica
Nevera = el refrigerador; Navaja
Olla; Ollita
Paraguas; Peine; Pelota; Perol = cualquier cosa, un coroto; Pipote = el tambor de basura; Papagayo = la cometa; Plato; Puerta; Pañuelo; Pinza
Reloj; Radio; Regla; Raqueta
Silla; Sartén; Sombrero; Sábana; Sacapuntas; Sofá
Tijera; Taza; Teléfono; Televisor; Toalla; Trompo; Tobo = el balde; Tenedor; Tambor
Uña de gato
Vaso; Ventilador; Vela; Ventana
Yoyo; Yesquero = el encendedor
Zapato; Zapatilla
`,
  estado: `
Amazonas = su capital es Puerto Ayacucho
Anzoátegui = su capital es Barcelona
Apure = su capital es San Fernando de Apure
Aragua = su capital es Maracay
Barinas = su capital es Barinas
Bolívar = su capital es Ciudad Bolívar
Carabobo = su capital es Valencia
Cojedes = su capital es San Carlos
Delta Amacuro = su capital es Tucupita
Distrito Capital = Caracas
Falcón = su capital es Coro
Guárico = su capital es San Juan de los Morros
La Guaira/Vargas = su capital es La Guaira, antes se llamaba Vargas
Lara = su capital es Barquisimeto
Mérida = su capital es Mérida
Miranda = su capital es Los Teques
Monagas = su capital es Maturín
Nueva Esparta/Margarita = su capital es La Asunción
Portuguesa = su capital es Guanare
Sucre = su capital es Cumaná
Táchira = su capital es San Cristóbal
Trujillo = su capital es Trujillo
Yaracuy = su capital es San Felipe
Zulia = su capital es Maracaibo
`,
  comida: `
Arepa = el pan de cada día; Asado negro = carne en salsa oscura de papelón; Arroz con leche; Arroz con pollo; Arepa de chicharrón; Ajiaco
Bienmesabe = dulce de coco; Bollo pelón = bolita de masa rellena en salsa; Bollitos; Buñuelos de yuca; Bocadillo de guayaba
Cachapa = torta de jojoto con queso de mano; Cachito = pan de jamón enrollado; Caraotas negras/Caraotas; Casabe = torta de yuca; Chicha = bebida de arroz; Chupe = sopa andina; Cocada = batido de coco; Cuajada; Chicharrón; Conserva de coco; Cabello de ángel
Dulce de lechosa; Domplina = bolita de harina frita; Dulce de leche
Empanada; Ensalada de gallina; Envuelto de maíz
Fororo = atol de maíz tostado; Funche
Golfeado = pan dulce enrollado con papelón y queso; Guasacaca = salsa de aguacate; Guayoyo = café clarito
Hallaca = el plato de Navidad envuelto en hoja de plátano; Hervido = sopa de res o gallina; Huevos pericos/Perico = revoltillo con tomate y cebolla
Jojoto = la mazorca de maíz tierno
Lau lau = bagre guisado
Majarete = dulce de maíz y coco; Mandoca = rosquilla zuliana de maíz y plátano; Mondongo; Muchacho redondo = carne mechada en salsa; Mazamorra; Mojito de chucho
Negro en camisa = postre de chocolate con crema
Obleas = galletas finitas con arequipe; Olleta
Pabellón = arroz, caraotas, carne mechada y tajadas; Pan de jamón = el pan navideño; Papelón con limón; Pasticho = la lasaña criolla; Patacón = sándwich zuliano de plátano verde; Pisca andina = sopa de papa con huevo; Polvorosa = pastel de pollo; Pastelito; Pernil; Plátano horneado
Quesillo = el flan venezolano; Queso de mano; Quesadilla
Reina pepiada = arepa de pollo con aguacate; Rueda de carite
Sancocho = sopa grande de domingo; Suspiro; Sopa de mondongo
Tequeño = palito de queso envuelto en masa; Torta negra; Tostones; Tajadas = plátano maduro frito; Tizana = ensalada de frutas en jugo; Talkarí = guiso oriental; Teta = jugo congelado en bolsita
Vuelve a la vida = cóctel de mariscos
Yuca frita; Yoyo = galleta rellena
`,
  palabra: `
A juro = a la fuerza, porque sí; A millón = a toda velocidad; Arrecho #crude = bravo, o algo buenísimo; Arrocero = el que llega a la fiesta sin invitación; Achantado = flojo, quedado
Bochinche = desorden, escándalo; Burda = mucho; Bululú = alboroto, montón de gente; Bonche = fiesta, rumba; Birra = cerveza; Bojote = un montón, o un bulto; Bolsa = tonto
Cambur = banana, o un puesto fácil; Catire = rubio; Chamo/Chama = muchacho, muchacha; Chévere = bueno, bonito; Chimbo = de mala calidad; Coroto = cualquier cosa; Cotufa = palomita de maíz; Cuaima = novia celosa y brava; Cónchale = expresión de sorpresa; Chalequear = burlarse de alguien; Chao pescao = adiós; Chorizo = una fila larga
Dar papaya = dar oportunidad, ponerse fácil
Echón = presumido; Embarcar = dejar plantado; Enratonado = con resaca; Empatado = de novio
Fino = excelente; Faramallero = presumido, aparatoso; Fuchi = qué asco
Gafo = tonto; Guachimán = el vigilante; Guarapo = jugo, o café clarito; Guayabo = tristeza de amor; Guachafita = relajo, desorden; Gocho = andino
Hablachento = el que habla mucho y no hace nada
Jeva = novia, muchacha; Jurungar = hurgar, revolver; Jalar mecate = adular; Jojoto = maíz tierno
Ladilla = algo fastidioso; Lambucio = glotón, que se come lo de todos; Lochas = monedas, plata
Macundales = las pertenencias, los corotos; Malandro = delincuente; Mamarracho = algo feo y mal hecho; Mecate = cuerda; Musiú = extranjero; Mamadera de gallo = echar broma; Matraca = soborno; Molleja = expresión de asombro
Niche = de mal gusto
Ñapa = el extra que te regala el vendedor; Ñero = amigo, pana
Pana = amigo; Pavoso = que trae mala suerte; Pea = borrachera; Perol = cualquier cosa; Pichirre = tacaño, no suelta ni un bolívar; Pajúo #crude = sapo, chismoso, o tonto; Pelazón = estar sin plata; Pelabola #crude = sin plata; Pantallero = el que aparenta; Parchita = maracuyá
Quemado = repetido, gastado
Rascao = borracho; Rumba = fiesta; Rolo = grande, tremendo
Sapo = chismoso, soplón; Sifrino = fresa, presumido; Sape = fuera, vete
Tripear = disfrutar; Tuki = de estilo llamativo; Toripollo = lío, problema
Vaina = cosa, asunto; Vacilón = algo divertido; Verga #crude = cosa (grosero)
Zape = fuera, vete; Zaperoco = alboroto, pelea; Zamuro = zopilote, o un aprovechado
`,
  dicho: `
A falta de pan, casabe = te conformas con lo que hay
Agua que no has de beber, déjala correr
Al que no quiere caldo se le dan dos tazas
Ando limpio = estoy sin plata
Barriga llena, corazón contento
Bicho malo nunca muere
Caracas es Caracas y lo demás es monte y culebra @${REEL} = chiste caraqueño: todo lo demás es campo
Calabaza, calabaza, cada quien para su casa = se acabó la fiesta
Camarón que se duerme se lo lleva la corriente
Cachicamo diciéndole a morrocoy conchúo = el que critica en otro lo que él mismo tiene
Del cielo pa' bajo todo es monte
Dime con quién andas y te diré quién eres
Dentro de lo que cabe = más o menos bien
El que no llora no mama = si no pides, no te dan
En la lucha por la locha = sin plata pero echándole pichón
Estás más perdido que el hijo de Lindbergh
Fresco como una lechuga
Guerra avisada no mata soldado
Gallina que come huevo, aunque le quemen el pico
Hijo de gato caza ratón
Indio comido, indio ido
La cosa se está poniendo color de hormiga @${REEL} = las cosas se están poniendo feas
La masa no está pa' bollo = las cosas están duras, no hay chance pa' extras
Loro viejo no aprende a hablar
Me agarró fuera de base = me agarró desprevenido
Más aburrido que mocho en piñata
Más salado que pescado en Semana Santa = con muy mala suerte
Más agarrado que viejita en moto = muy tacaño
Mamando y loco = sin plata pero de fiesta
Nadie sabe lo que hay en la olla sino la cuchara que la menea
No hay quinto malo
No nos despechamos, nos enguayabamos
Ojos que no ven, corazón que no siente
Otro gallo cantaría
Perro que ladra no muerde
Pájaro que comió, voló
Quien tiene padrino se bautiza
Quien se mete a redentor sale crucificado
Se te ve el bojote = se te nota
Suda más que un maracucho encerrado
Te quedaste sin el chivo y sin el mecate = perdiste el premio y lo que tenías
Tú sabes cómo es = mejor ni preguntes
Tanto nadar para morir en la orilla
Una mano lava la otra
Unos nacen con estrella y otros estrellados
Vale más pájaro en mano que cien volando
Vamos a ver, dijo un ciego
Yo no soy monedita de oro pa' caerle bien a todos
Zapatero a tus zapatos
`,
  pelotero: `
Altuve/José Altuve = segunda base, MVP de la Liga Americana 2017
Aparicio/Luis Aparicio = campocorto, Salón de la Fama
Acuña/Ronald Acuña/Ronald Acuña Jr. = MVP de la Liga Nacional 2023
Abreu/Bob Abreu/Bobby Abreu = jardinero de Aragua
Alfonzo/Edgardo Alfonzo = el Potro, de los Mets
Andrus/Elvis Andrus = campocorto de Maracay
Arráez/Luis Arráez = campeón de bate
Armas/Tony Armas = jonronero de los Atléticos
Álvarez/Wilson Álvarez = lanzó un juego sin hit
Cabrera/Miguel Cabrera/Miggy = Triple Corona 2012
Carrasquel/Chico Carrasquel = el primer venezolano en un Juego de Estrellas
Concepción/Dave Concepción = campocorto de la Gran Maquinaria Roja
Carrasco/Carlos Carrasco = Cookie, abridor
Chourio/Jackson Chourio = jardinero de Maracaibo
Contreras/Willson Contreras = receptor de Puerto Cabello
Davalillo/Vitico Davalillo = jardinero, leyenda de los Leones
Díaz/Bo Díaz = receptor de Cumaná
Escobar/Kelvim Escobar = lanzador de La Guaira
Galarraga/Andrés Galarraga/El Gato = el Gato, primera base
García/Freddy García = el Jefe, abridor
González/Carlos González/CarGo = jardinero de Maracaibo
Guillén/Ozzie Guillén = campocorto y mánager campeón
Hernández/Félix Hernández/King Félix = el Rey Félix, juego perfecto
Inciarte/Ender Inciarte = guante de oro
Odor/Rougned Odor = segunda base de Maracaibo
Ordóñez/Magglio Ordóñez = jardinero de los Tigres
Pérez/Salvador Pérez/Salvy = receptor campeón con Kansas City
Prado/Martín Prado = utility de Maracay
Rodríguez/Francisco Rodríguez/K-Rod = récord de salvados en una temporada
Rojas/Miguel Rojas = campocorto de Los Teques
Santana/Johan Santana = el primer juego sin hit de los Mets
Sandoval/Pablo Sandoval/Kung Fu Panda = el Panda, tres jonrones en un juego de Serie Mundial
Scutaro/Marco Scutaro = MVP de la Serie de Campeonato 2012
Suárez/Eugenio Suárez = antesalista de Puerto Ordaz
Torres/Gleyber Torres = segunda base de Caracas
Trillo/Manny Trillo = segunda base de Caripito
Urbina/Ugueth Urbina = cerrador
Vizquel/Omar Vizquel = once guantes de oro
Zambrano/Carlos Zambrano = el Toro, abridor de los Cachorros
`,
  musica: `
Alí Primera = el cantor del pueblo; Alma llanera = el segundo himno de Venezuela; Aldemaro Romero; Amigos Invisibles/Los Amigos Invisibles; Akapellah; Apache; Aquiles Báez
Billo's Caracas Boys/Billos = orquesta de baile clásica; Barlovento = canción de Eduardo Serrano; Benjamín Rausseo
Caballo viejo = la canción de Simón Díaz; Cecilia Todd; Chino y Nacho; Chyno Miranda; Cholo Valderrama; Canaima = canción de Juan Vicente Torrealba
Danny Ocean = cantó Me rehúso; Desorden Público = ska caraqueño; Dama antañona; Diablo suelto/El diablo suelto = joropo clásico
Elena Rose; El Puma/José Luis Rodríguez; Estelares/Los Estelares
Franco De Vita; Fiesta en Elorza = joropo de Eneas Perdomo
Guaco = la superbanda del Zulia; Gualberto Ibarreto; Gran Coquivacoa = gaita zuliana
Hugo Blanco = compuso Moliendo café; Henry Stephen
Ilan Chester
Jorge Guerrero; Juan Vicente Torrealba
Karina = la de Sé que te vas
Lila Morillo; Lasso; Linda = la de los Billo's
Moliendo café; Mirla Castellanos; Mau y Ricky; Melódicos/Los Melódicos; Me rehúso = canción de Danny Ocean
Nacho; Neguito Borjas; Nerú
Oscar D'León/Óscar de León = el sonero del mundo; Onechot
Pajarillo = joropo; Pastor López
Reynaldo Armas = cantó La muerte del rucio moro; Ricardo Montaner; Rawayana; Río Manzanares; Ricardo Aguirre = el monumental de la gaita
Simón Díaz = Tío Simón; Soledad Bravo; Servando y Florentino; Sixto Rein; Serenata Guayanesa
Tonada de luna llena; Tecupae
Un Solo Pueblo
Venezuela = la canción que cantó José Luis Rodríguez
Yordano
`,
  lugar: `
Ávila/El Ávila/Waraira Repano = la montaña de Caracas; Adícora; Apartaderos; Archipiélago Los Testigos/Los Testigos; Altamira; Auyantepuy
Barlovento; Bahía de Cata/Cata; Boca de Aroa
Canaima = parque nacional de los tepuyes; Choroní = pueblo de playa en Aragua; Colonia Tovar = pueblito alemán en la montaña; Cueva del Guácharo; Coche/Isla de Coche; Cubagua; Chichiriviche; Catatumbo = el relámpago que nunca se apaga; Cuyagua; Caripe; Chuao = el pueblo del mejor cacao
Delta del Orinoco/Delta; Dunas de Coro
El Yaque = playa de Margarita para el windsurf; El Hatillo; Elorza; El Tocuyo
Fortín Solano = el fuerte en el cerro de Puerto Cabello
Naiguatá = pueblo de costa y pico del Ávila
Galipán = pueblo en la montaña del Ávila; Gran Sabana; Guatopo
Henri Pittier = el parque nacional más viejo del país; Higuerote; Hato Piñero
Isla de Margarita/Margarita; Isla de Aves; Isla La Tortuga/La Tortuga
Jají = pueblito colonial de Mérida; Juan Griego
Kavac = cueva y cañón en la Gran Sabana; Kerepakupai Merú/Salto Ángel = el salto de agua más alto del mundo
Los Roques = archipiélago de agua cristalina; Lago de Maracaibo; Los Nevados; La Guaira; Los Llanos; Laguna de Mucubají/Mucubají
Médanos de Coro/Los Médanos = desierto de dunas en Falcón; Mochima; Morrocoy = parque de cayos en Falcón; Mucuchíes; Mukumbarí = el teleférico de Mérida
Ocumare de la Costa/Ocumare
Pico Bolívar = la montaña más alta de Venezuela; Paraguaná; Puerto Colombia; Playa El Agua; Playa Colorada; Playa Medina; Paria; Petare; Pampatar; Puerto Cruz
Quebrada de la Virgen
Roraima = el tepuy más famoso; Río Caribe
Salto Ángel/Kerepakupai Merú = el salto de agua más alto del mundo; Sabana Grande; Sierra Nevada; Sanare
Tucacas; Turiamo; Tacarigua/Lago de Valencia
Uverito
Valle de la Pascua
Yacambú
?El coño 'e la madre #crude @${REEL} = un sitio lejísimo
?Monte y culebra @${REEL} = todo lo que no es Caracas, según los caraqueños
`,
  marca: `
Adidas; Apple; Arturo's; Atún Margarita
Big Cola; Bimbo; Belmont
Cocosette = galleta de coco, un clásico; Cri-Cri; Cacique; Chinotto; Coca-Cola; Cheese Tris; Chocolates El Rey/El Rey; Canon; Casio; Colgate
Diablitos Underwood/Diablitos = el diablito en lata; Diplomático; Doritos; Dove
Efe/Helados EFE; Excelsior Gama
Frescolita = el refresco de colita rojo; Flips; Fanta; Ford; Facebook
Golden = el refresco de manzana; Glup; Gatorade; Gillette; Google; Gucci
Harina PAN = la harina de las arepas; Honda; Huggies; Heinz
IKEA; Iansa
Jeep; Johnson's
Kellogg's; Kia; Kodak
Las Llaves; Lacoste; Lego; Levi's
Maltín Polar/Malta = la malta de siempre; Mavesa; Mazda; McDonald's; Motorola
Natulac; Nucita = crema de dos sabores; Nestlé; Nike; Nintendo; Nokia
Oster; Omega
Polar = la cerveza; Pirulín = barquillo relleno; Pampero; Pepito; Pepsi; Puma
Quaker
Rikesa; Ruffles; Reebok; Rolex; Ray-Ban
Savoy = la marca del chocolate; Samba = galleta bañada en chocolate; Susy = galleta rellena; Santa Teresa = ron de Aragua; Samsung; Sony; Suzuki
Toddy = el chocolate en polvo; Toronto = bombón de avellana; Tío Rico = los helados del carrito; Toyota; Tupperware
Uniko
Vans; Volkswagen
Xbox
Yukery = jugo de frutas; Yamaha
Zara
`,
  carinoso: `
Abombado = medio aturdido, despistado; Atolondrado; Arrastrado = jalamecate
Bolsa = tonto; Bobolongo = bobo grandote; Bocón = el que habla de más
Cabeza 'e chorlito/Cabeza de chorlito = despistado; Chupamedia = adulador; Cuaima = novia celosa; Comegallina = el que se come todo
Despistado; Dormilón
Echón = presumido
Faramallero = presumido, exagerado; Flojo; Fosforito = el que se prende rapidito
Gafo = tonto; Guabinoso = el que no se decide; Gocho = andino, de cariño
Hablachento = habla y habla y no hace nada
Jalamecate = adulador; Jalabolas #crude = adulador
Ladilla = fastidioso; Lambucio = glotón; Lento
Mamarracho = feo y mal hecho; Malcriado; Mente 'e pollo = de poca memoria
Niche = de mal gusto
Ñoño
Pavoso = trae mala suerte; Pichirre = tacaño; Pantallero = aparentón; Pelele; Pajúo #crude = tonto, chismoso; Pataruco = torpe, de mala calidad
Quejón
Regalado = el que se ofrece demasiado
Sapo = chismoso; Sifrino = presumido; Sinvergüenza
Tracalero = tramposo; Tarúpido = tarado y estúpido a la vez; Tuki = llamativo
Vivo = aprovechado
Zángano = flojo, vividor; Zoquete = torpe; Zamuro = aprovechado
`,
};

function parse(category, text) {
  const out = [];
  for (const raw of text.split(/\n|;/)) {
    const line = raw.trim(); if (!line) continue;
    const cut = line.indexOf(' = '), head = cut >= 0 ? line.slice(0, cut) : line, explain = cut >= 0 ? line.slice(cut + 3).trim() : '';
    const tags = head.match(/[#@][\w-]+/g) || [], names = head.replace(/[#@][\w-]+/g, '').trim();
    const doubtful = names.startsWith('?');
    const forms = names.replace(/^\?/, '').replace(/\?\s*$/, '').split('/').map(s => s.trim()).filter(Boolean);
    if (!forms.length) continue;
    const source = tags.find(t => t.startsWith('@'))?.slice(1) || 'pana';
    const joke = tags.find(t => t.startsWith('#') && !['#crude', '#duda'].includes(t))?.slice(1) || null;
    out.push(Object.freeze({ category, word: forms[0], variants: Object.freeze(forms.slice(1)), explain, source,
      crude: tags.includes('#crude'), doubtful: doubtful || tags.includes('#duda'), joke }));
  }
  return out;
}

export const SABER = Object.freeze(Object.entries(RAW).flatMap(([category, text]) => parse(category, text)));

// Words no table sees unless it opts into "más criollo", whatever the
// category. Entries flagged crude above count too (see saber-match.js).
export const CRUDE_WORDS = Object.freeze(['coño', 'coñoemadre', 'verga', 'mierda', 'puta', 'puto', 'marico', 'marica', 'mamaguevo',
  'mamagüevo', 'guevon', 'güevón', 'huevon', 'pajuo', 'pajúo', 'carajo', 'culo', 'cabron', 'cabrón', 'arrecho', 'jalabolas', 'pelabola', 'pelabolas', 'joder']);
