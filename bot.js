const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ===============================
   CONFIGURACIÓN
================================*///////

const CONFIG = {
  CANAL: 'telegram',
  TELEGRAM_TOKEN: '8645647894:AAFDQFUs5PfDszCtzbDlYrJccCV5ul94sEs',   
  
};


const PERMISOS_URL = 'https://script.google.com/macros/s/AKfycbwVX-cyiGJl8vE3uBj0g6qWKv6ivNlHtir1BnoSqXVYHZwyB4E6mSEX2VSaeF623d0w/exec';

async function verificarPermiso(userId, telefono = null, accion = 'consultar') {
  try {
    const res = await fetch(PERMISOS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, telefono, accion })
    });
    return await res.json();
  } catch (e) {
    return { permitido: false, mensaje: 'Error de permisos' };
  }
  
}

/* ===============================
   PARSEAR DIRECCIÓN DESDE TEXTO LIBRE
================================*/
function parsearDireccion(texto) {
  const normalize = s =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = normalize(texto.trim().toLowerCase());

  // "San Martin 167, coquimbo" → partes[0]="san martin 167", partes[1]="coquimbo"
  const partes = t.split(',').map(p => p.trim());
  const partePrincipal = partes[0]; // calle + número
  const parteSecundaria = partes.slice(1).join(' '); // comuna/región


  // --- REGIÓN (default metropolitana si no detecta nada) ---
  let region = 'metropolitana';
  const regiones = [
    ['region metropolitana', 'metropolitana'],
    ['metropolitana', 'metropolitana'],
    ['rm', 'metropolitana'],
    ['valparaiso', 'valparaiso'],
    ['quinta region', 'valparaiso'],
    ['v region', 'valparaiso'],
    ['ohiggins', 'ohiggins'],
    ['libertador', 'ohiggins'],
    ['sexta region', 'ohiggins'],
    ['vi region', 'ohiggins'],
    ['maule', 'maule'],
    ['septima region', 'maule'],
    ['vii region', 'maule'],
    ['nuble', 'nuble'],
    ['xvi region', 'nuble'],
    ['biobio', 'biobio'],
    ['octava region', 'biobio'],
    ['viii region', 'biobio'],
    ['araucania', 'araucania'],
    ['novena region', 'araucania'],
    ['ix region', 'araucania'],
    ['los rios', 'los rios'],
    ['xiv region', 'los rios'],
    ['los lagos', 'los lagos'],
    ['decima region', 'los lagos'],
    ['x region', 'los lagos'],
    ['aysen', 'aysen'],
    ['xi region', 'aysen'],
    ['magallanes', 'magallanes'],
    ['xii region', 'magallanes'],
    ['arica y parinacota', 'arica y parinacota'],
    ['arica', 'arica y parinacota'],
    ['xv region', 'arica y parinacota'],
    ['tarapaca', 'tarapaca'],
    ['primera region', 'tarapaca'],
    ['i region', 'tarapaca'],
    ['antofagasta', 'antofagasta'],
    ['segunda region', 'antofagasta'],
    ['ii region', 'antofagasta'],
    ['atacama', 'atacama'],
    ['tercera region', 'atacama'],
    ['iii region', 'atacama'],
    ['coquimbo', 'coquimbo'],
    ['cuarta region', 'coquimbo'],
    ['iv region', 'coquimbo'],
  ];
  for (const [key, val] of regiones) {
    if (t.includes(normalize(key))) { region = val; break; }
  }

  // --- NÚMERO ---
  const matchNumero = t.match(/\b(\d{1,5})\b/);
  const numero = matchNumero ? matchNumero[1] : '';

  // --- DEPTO ---
  let depto = '';
  const matchDepto = t.match(
    /(?:depto?\.?|departamento|dpto\.?|piso|oficina|casa)\s*[:#-]?\s*([a-z0-9]+)/i
  );
  if (matchDepto) depto = matchDepto[1];

  // --- COMUNA ---
  let comuna = '';

  const comunasConocidas = [
    'aisen', 'algarrobo', 'alhue', 'alto biobio', 'alto del carmen',
    'alto hospicio', 'ancud', 'andacollo', 'angol', 'antofagasta',
    'antuco', 'antartica', 'arauco', 'arica', 'buin', 'bulnes',
    'cabildo', 'cabo de hornos', 'cabrero', 'calama', 'calbuco',
    'caldera', 'calera de tango', 'calera', 'calle larga', 'camarones',
    'camina', 'canela', 'carahue', 'cartagena', 'casablanca', 'castro',
    'catemu', 'cauquenes', 'canete', 'cerrillos', 'cerro navia',
    'chaiten', 'chanco', 'chanaral', 'chepica', 'chiguayante',
    'chile chico', 'chillan viejo', 'chillan', 'chimbarongo', 'cholchol',
    'chonchi', 'cisnes', 'cobquecura', 'cochamo', 'cochrane', 'codegua',
    'coelemu', 'coihueco', 'coinco', 'colbun', 'colchane', 'colina',
    'collipulli', 'coltauco', 'combarbala', 'concepcion', 'conchali',
    'concon', 'constitucion', 'contulmo', 'copiapo', 'coquimbo',
    'coronel', 'corral', 'coyhaique', 'cunco', 'curacautin', 'curacavi',
    'curaco de velez', 'curanilahue', 'curarrehue', 'curepto', 'dalcahue',
    'diego de almagro', 'donihue', 'el bosque', 'el carmen', 'el monte',
    'el quisco', 'el tabo', 'empedrado', 'ercilla', 'estacion central',
    'florida', 'freire', 'freirina', 'fresia', 'frutillar', 'futaleufu',
    'futrono', 'galvarino', 'gorbea', 'graneros', 'guaitecas', 'hijuelas',
    'hualaihe', 'hualane', 'hualpen', 'hualqui', 'huara', 'huasco',
    'huechuraba', 'illapel', 'independencia', 'iquique', 'isla de maipo',
    'isla de pascua', 'juan fernandez', 'la calera', 'la cisterna',
    'la cruz', 'la estrella', 'la florida', 'la granja', 'la higuera',
    'la ligua', 'la pintana', 'la reina', 'la serena', 'la union',
    'lago verde', 'laguna blanca', 'laja', 'lampa', 'lanco', 'las cabras',
    'las condes', 'lautaro', 'lebu', 'licanten', 'limache', 'linares',
    'litueche', 'llanquihue', 'llay-llay', 'lo barnechea', 'lo espejo',
    'lo prado', 'lolol', 'loncoche', 'longavi', 'lonquimay', 'los alamos',
    'los andes', 'los angeles', 'los lagos', 'los muermos', 'los sauces',
    'los vilos', 'lumaco', 'machali', 'macul', 'mafil', 'maipu', 'malloa',
    'marchigue', 'mariquina', 'maria elena', 'maria pinto', 'maule',
    'maullin', 'mejillones', 'melipeuco', 'melipilla', 'molina',
    'monte patria', 'mostazal', 'mulchen', 'nacimiento', 'nancagua',
    'navidad', 'negrete', 'ninhue', 'nogales', 'nueva imperial', 'niquen',
    'nunoa', 'ollague', 'olivar', 'olmue', 'osorno', 'ovalle',
    'padre hurtado', 'padre las casas', 'paihuano', 'paillaco', 'paine',
    'palena', 'palmilla', 'panguipulli', 'panquehue', 'papudo',
    'paredones', 'parral', 'pedro aguirre cerda', 'pelarco', 'pelluhue',
    'penaflor', 'pemuco', 'perquenco', 'pica', 'pichidegua', 'pichilemu',
    'pitrufquen', 'pozo almonte', 'portezuelo', 'porvenir', 'providencia',
    'pucon', 'pudahuel', 'puente alto', 'puerto montt', 'puerto octay',
    'puerto varas', 'pumanque', 'puren', 'putaendo', 'quellon',
    'quilicura', 'quilpue', 'quillota', 'quintero', 'quirihue',
    'rancagua', 'rauco', 'renca', 'rengo', 'recoleta', 'retiro',
    'rinconada', 'rio bueno', 'rio claro', 'rio hurtado', 'rio ibanez',
    'rio negro', 'romeral', 'saavedra', 'sagrada familia', 'salamanca',
    'san antonio', 'san bernardo', 'san carlos', 'san clemente',
    'san esteban', 'san fabian', 'san felipe', 'san fernando',
    'san francisco de mostazal', 'san gregorio', 'san ignacio',
    'san javier', 'san joaquin', 'san jose de maipo', 'san juan de la costa',
    'san miguel', 'san nicolas', 'san pablo', 'san pedro de atacama',
    'san pedro de la paz', 'san pedro', 'san rafael', 'san ramon',
    'san rosendo', 'san vicente', 'santa barbara', 'santa cruz',
    'santa juana', 'santa maria', 'santiago', 'santo domingo',
    'sierra gorda', 'talagante', 'talca', 'talcahuano', 'taltal', 'temuco',
    'teno', 'teodoro schmidt', 'tierra amarilla', 'tiltil', 'timaukel',
    'tirua', 'tocopilla', 'tolten', 'tome', 'torres del paine', 'tortel',
    'traiguen', 'trehuaco', 'tucapel', 'valdivia', 'vallenar', 'valparaiso',
    'vichuquen', 'victoria', 'vicuna', 'vilcun', 'villa alegre',
    'villa alemana', 'villarrica', 'vina del mar', 'vitacura',
    'yerbas buenas', 'yumbel', 'yungay', 'zapallar'
  ];

  // Ordenar de mayor a menor longitud para evitar matches parciales
  // (ej: "san pedro de atacama" antes que "san pedro")
  comunasConocidas.sort((a, b) => b.length - a.length);

  // 1. REGLA DE ORO (CON COMA): Si el usuario usó comas, damos prioridad absoluta 
  // a buscar la comuna en los fragmentos de texto que están DESPUÉS de la primera coma.
  // Así evitamos que "Independencia 21, Limache" tome "Independencia" como comuna.
  if (partes.length > 1) {
    for (let i = 1; i < partes.length; i++) {
      for (const c of comunasConocidas) {
        if (partes[i].includes(c)) {
          comuna = c;
          break;
        }
      }
      if (comuna) break;
    }
  }

  // 2. REGLA LIBRE (SIN COMA): Si no había comas o no se encontró ninguna comuna tras la coma
  if (!comuna) {
    // Intentar detectar por palabra clave "comuna X" o "en X"
    const matchComuna = t.match(
      /(?:comuna|en)\s+([a-z\s]+?)(?:\s*,|\s*region|\s*rm|\s*$)/i
    );
    if (matchComuna) {
      comuna = matchComuna[1].trim();
    } else {
      // Si no hay palabra clave, buscar en todo el texto
      for (const c of comunasConocidas) {
        if (t.includes(c)) { comuna = c; break; }
      }
    }
  }

  // --- INFERIR REGIÓN DESDE COMUNA si no se detectó explícitamente ---
  // (solo cuando el texto no mencionó región directamente)
  if (region === 'metropolitana') {
    const comunaRegionMap = {
      // Valparaíso
      'valparaiso': 'valparaiso', 'vina del mar': 'valparaiso',
      'quilpue': 'valparaiso', 'villa alemana': 'valparaiso',
      'quillota': 'valparaiso', 'san antonio': 'valparaiso',
      'san felipe': 'valparaiso', 'los andes': 'valparaiso',
      'calera': 'valparaiso', 'la calera': 'valparaiso',
      'limache': 'valparaiso', 'concon': 'valparaiso',
      'quintero': 'valparaiso', 'casablanca': 'valparaiso',
      'cartagena': 'valparaiso', 'el quisco': 'valparaiso',
      'el tabo': 'valparaiso', 'algarrobo': 'valparaiso',
      'papudo': 'valparaiso', 'zapallar': 'valparaiso',
      'la ligua': 'valparaiso', 'cabildo': 'valparaiso',
      'putaendo': 'valparaiso', 'panquehue': 'valparaiso',
      'catemu': 'valparaiso', 'hijuelas': 'valparaiso',
      'nogales': 'valparaiso', 'puchuncavi': 'valparaiso',
      'olmue': 'valparaiso', 'juan fernandez': 'valparaiso',
      'isla de pascua': 'valparaiso', 'rinconada': 'valparaiso',
      'calle larga': 'valparaiso', 'llay-llay': 'valparaiso',
      'santo domingo': 'valparaiso',
      // O'Higgins
      'rancagua': 'ohiggins', 'san fernando': 'ohiggins',
      'rengo': 'ohiggins', 'machali': 'ohiggins',
      'graneros': 'ohiggins', 'codegua': 'ohiggins',
      'mostazal': 'ohiggins', 'san francisco de mostazal': 'ohiggins',
      'olivar': 'ohiggins', 'coinco': 'ohiggins',
      'coltauco': 'ohiggins', 'donihue': 'ohiggins',
      'malloa': 'ohiggins', 'requinoa': 'ohiggins',
      'quinta de tilcoco': 'ohiggins', 'san vicente': 'ohiggins',
      'pichidegua': 'ohiggins', 'las cabras': 'ohiggins',
      'peumo': 'ohiggins', 'chimbarongo': 'ohiggins',
      'nancagua': 'ohiggins', 'placilla': 'ohiggins',
      'lolol': 'ohiggins', 'palmilla': 'ohiggins',
      'peralillo': 'ohiggins', 'santa cruz': 'ohiggins',
      'chepica': 'ohiggins', 'pumanque': 'ohiggins',
      'pichilemu': 'ohiggins', 'marchigue': 'ohiggins',
      'litueche': 'ohiggins', 'la estrella': 'ohiggins',
      'navidad': 'ohiggins', 'paredones': 'ohiggins',
      'san clemente': 'ohiggins',
      // Maule
      'talca': 'maule', 'curico': 'maule',
      'linares': 'maule', 'cauquenes': 'maule',
      'constitucion': 'maule', 'molina': 'maule',
      'san javier': 'maule', 'parral': 'maule',
      'retiro': 'maule', 'longavi': 'maule',
      'villa alegre': 'maule', 'yerbas buenas': 'maule',
      'colbun': 'maule', 'san rafael': 'maule',
      'pelarco': 'maule', 'rio claro': 'maule',
      'sagrada familia': 'maule', 'teno': 'maule',
      'romeral': 'maule', 'licanten': 'maule',
      'vichuquen': 'maule', 'hualane': 'maule',
      'rauco': 'maule', 'curepto': 'maule',
      'empedrado': 'maule', 'maule': 'maule',
      'pelluhue': 'maule', 'chanco': 'maule',
      'pencahue': 'maule',
      // Ñuble
      'chillan': 'nuble', 'chillan viejo': 'nuble',
      'san carlos': 'nuble', 'bulnes': 'nuble',
      'yungay': 'nuble', 'el carmen': 'nuble',
      'pemuco': 'nuble', 'pinto': 'nuble',
      'coihueco': 'nuble', 'niquen': 'nuble',
      'san fabian': 'nuble', 'san nicolas': 'nuble',
      'quirihue': 'nuble', 'cobquecura': 'nuble',
      'trehuaco': 'nuble', 'ninhue': 'nuble',
      'portezuelo': 'nuble', 'coelemu': 'nuble',
      'ranquil': 'nuble', 'treguaco': 'nuble',
      // Biobío
      'concepcion': 'biobio', 'talcahuano': 'biobio',
      'coronel': 'biobio', 'los angeles': 'biobio',
      'chiguayante': 'biobio', 'hualpen': 'biobio',
      'san pedro de la paz': 'biobio', 'tome': 'biobio',
      'penco': 'biobio', 'florida': 'biobio',
      'santa juana': 'biobio', 'hualqui': 'biobio',
      'cabrero': 'biobio', 'yumbel': 'biobio',
      'laja': 'biobio', 'nacimiento': 'biobio',
      'negrete': 'biobio', 'mulchen': 'biobio',
      'quilaco': 'biobio', 'santa barbara': 'biobio',
      'alto biobio': 'biobio', 'tucapel': 'biobio',
      'antuco': 'biobio', 'quilleco': 'biobio',
      'arauco': 'biobio', 'lebu': 'biobio',
      'curanilahue': 'biobio', 'los alamos': 'biobio',
      'canete': 'biobio', 'contulmo': 'biobio',
      'tirua': 'biobio',
      // Araucanía
      'temuco': 'araucania', 'padre las casas': 'araucania',
      'angol': 'araucania', 'victoria': 'araucania',
      'nueva imperial': 'araucania', 'pitrufquen': 'araucania',
      'villarrica': 'araucania', 'pucon': 'araucania',
      'lautaro': 'araucania', 'traiguen': 'araucania',
      'collipulli': 'araucania', 'mulchen': 'araucania',
      'curacautin': 'araucania', 'lonquimay': 'araucania',
      'cunco': 'araucania', 'freire': 'araucania',
      'teodoro schmidt': 'araucania', 'tolten': 'araucania',
      'saavedra': 'araucania', 'carahue': 'araucania',
      'galvarino': 'araucania',
      'cholchol': 'araucania', 'lumaco': 'araucania',
      'los sauces': 'araucania', 'ercilla': 'araucania',
      'perquenco': 'araucania', 'vilcun': 'araucania',
      'melipeuco': 'araucania', 'curarrehue': 'araucania',
      'gorbea': 'araucania', 'loncoche': 'araucania',
      // Los Ríos
      'valdivia': 'los rios', 'la union': 'los rios',
      'rio bueno': 'los rios', 'osorno': 'los rios',
      'paillaco': 'los rios', 'futrono': 'los rios',
      'lanco': 'los rios', 'mariquina': 'los rios',
      'mafil': 'los rios', 'corral': 'los rios',
      'panguipulli': 'los rios', 'lago ranco': 'los rios',
      // Los Lagos
      'puerto montt': 'los lagos', 'osorno': 'los lagos',
      'puerto varas': 'los lagos', 'castro': 'los lagos',
      'ancud': 'los lagos', 'calbuco': 'los lagos',
      'llanquihue': 'los lagos', 'frutillar': 'los lagos',
      'los muermos': 'los lagos', 'maullin': 'los lagos',
      'rio negro': 'los lagos', 'purranque': 'los lagos',
      'puyehue': 'los lagos', 'puerto octay': 'los lagos',
      'fresia': 'los lagos', 'cochamo': 'los lagos',
      'hualaihue': 'los lagos', 'chaiten': 'los lagos',
      'futaleufu': 'los lagos', 'palena': 'los lagos',
      'quellon': 'los lagos', 'quemchi': 'los lagos',
      'dalcahue': 'los lagos', 'curaco de velez': 'los lagos',
      'quinchao': 'los lagos', 'puqueldon': 'los lagos',
      'chonchi': 'los lagos', 'queilen': 'los lagos',
      'los lagos': 'los lagos',
      // Aysén
      'coyhaique': 'aysen', 'aisen': 'aysen',
      'cochrane': 'aysen', 'chile chico': 'aysen',
      'cisnes': 'aysen', 'guaitecas': 'aysen',
      'lago verde': 'aysen', 'rio ibanez': 'aysen',
      'tortel': 'aysen', 'o higgins': 'aysen',
      // Magallanes
      'punta arenas': 'magallanes', 'puerto natales': 'magallanes',
      'porvenir': 'magallanes', 'puerto williams': 'magallanes',
      'torres del paine': 'magallanes', 'laguna blanca': 'magallanes',
      'rio verde': 'magallanes', 'san gregorio': 'magallanes',
      'timaukel': 'magallanes', 'cabo de hornos': 'magallanes',
      'antartica': 'magallanes',
      // Arica y Parinacota
      'arica': 'arica y parinacota', 'camarones': 'arica y parinacota',
      'putre': 'arica y parinacota', 'general lagos': 'arica y parinacota',
      // Tarapacá
      'iquique': 'tarapaca', 'alto hospicio': 'tarapaca',
      'pozo almonte': 'tarapaca', 'camina': 'tarapaca',
      'colchane': 'tarapaca', 'huara': 'tarapaca',
      'pica': 'tarapaca',
      // Antofagasta
      'antofagasta': 'antofagasta', 'calama': 'antofagasta',
      'tocopilla': 'antofagasta', 'mejillones': 'antofagasta',
      'taltal': 'antofagasta', 'sierra gorda': 'antofagasta',
      'san pedro de atacama': 'antofagasta', 'ollague': 'antofagasta',
      'maria elena': 'antofagasta',
      // Atacama
      'copiapo': 'atacama', 'vallenar': 'atacama',
      'chanaral': 'atacama', 'caldera': 'atacama',
      'tierra amarilla': 'atacama', 'diego de almagro': 'atacama',
      'freirina': 'atacama', 'huasco': 'atacama',
      'alto del carmen': 'atacama',
      // Coquimbo
      'la serena': 'coquimbo', 'coquimbo': 'coquimbo',
      'ovalle': 'coquimbo', 'illapel': 'coquimbo',
      'andacollo': 'coquimbo', 'vicuna': 'coquimbo',
      'paihuano': 'coquimbo', 'monte patria': 'coquimbo',
      'combarbala': 'coquimbo', 'rio hurtado': 'coquimbo',
      'salamanca': 'coquimbo', 'los vilos': 'coquimbo',
      'canela': 'coquimbo', 'la higuera': 'coquimbo',
    };

    if (comuna && comunaRegionMap[comuna]) {
      region = comunaRegionMap[comuna];
    }
  }

  // --- CALLE ---
  let calle = partePrincipal;  // ← USA SOLO LO QUE ESTÁ ANTES DE LA COMA   ////  NO BORRAR
  if (numero) calle = calle.replace(numero, '').trim();
  if (matchDepto) calle = calle.replace(normalize(matchDepto[0]), '').trim();
  if (comuna) calle = calle.replace(comuna, '').trim();
  calle = calle
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(en|la|los|las|el)\s+/i, '')
    .trim();

  return { region, comuna: comuna || null, calle, numero, depto };
}

/* ===============================
   UTILIDADES LEVENSHTEIN
================================*/
function normalizarTexto(texto) {
  let resultado = texto
    .toLowerCase()
    .normalize('NFD')              // Separa acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^a-z0-9\s]/g, '')   // Elimina caracteres especiales
    .trim()
    .replace(/\s+/g, ' ');         // Unifica espacios
  
  const prefijosCalles = [
    'av', 'avenida', 'avda', 'avd',
    'calle', 'c', 'ca',
    'pasaje', 'psje', 'psj', 'pje',
    'camino', 'cno',
    'jiron', 'jr',
    'alameda', 'ala'
  ];
  
  const palabras = resultado.split(' ');
  const palabrasFiltradas = palabras.filter(palabra => {
    return !prefijosCalles.includes(palabra);
  });
  
  if (palabrasFiltradas.length > 0) {
    resultado = palabrasFiltradas.join(' ');
  }
  
  return resultado;
}

function calcularDistanciaLevenshtein(a, b) {
  const matriz = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matriz[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + costo
      );
    }
  }
  return matriz[a.length][b.length];
}

function generarVariaciones(texto) {
  const variantes = new Set();
  const base = normalizarTexto(texto);
  variantes.add(base);
  const prefijos = [
    ['avenida', 'av'], ['av', 'avenida'],
    ['pasaje', 'psje'], ['psje', 'pasaje'],
    ['calle', ''], ['', 'calle'],
    ['general', 'gral'], ['gral', 'general'],
    ['doctor', 'dr'], ['dr', 'doctor'],
    ['presidente', 'pte'], ['pte', 'presidente']
  ];
  for (const [a, b] of prefijos) {
    if (a && base.startsWith(a + ' '))
      variantes.add(b ? base.replace(a + ' ', b + ' ') : base.replace(a + ' ', ''));
    if (b && base.startsWith(b + ' '))
      variantes.add(base.replace(b + ' ', a + ' '));
  }
  return [...variantes].filter(v => v.length > 0);
}

function encontrarMejorCoincidencia(busqueda, opciones) {
  const baseBusqueda = normalizarTexto(busqueda);
  const variaciones  = generarVariaciones(busqueda);
  let mejorOpcion = null, mejorScore = Infinity, mejorMetodo = '';
  for (const opcion of opciones) {
    const baseOpcion = normalizarTexto(opcion.texto);
    if (baseOpcion === baseBusqueda) return { opcion, score: 0, metodo: 'exacta' };
    for (const v of variaciones)
      if (baseOpcion === v) return { opcion, score: 0, metodo: `variante:${v}` };
    if (baseOpcion.includes(baseBusqueda) || baseBusqueda.includes(baseOpcion)) {
      const score = Math.abs(baseOpcion.length - baseBusqueda.length);
      if (score < mejorScore) { mejorScore = score; mejorOpcion = opcion; mejorMetodo = 'contains'; }
      continue;
    }
    const dist = calcularDistanciaLevenshtein(baseBusqueda, baseOpcion);
    if (dist < 5 && dist < mejorScore) {
      mejorScore = dist; mejorOpcion = opcion; mejorMetodo = `levenshtein(${dist})`;
    }
  }
  return mejorOpcion ? { opcion: mejorOpcion, score: mejorScore, metodo: mejorMetodo } : null;
}

function generarVariacionesNumero(numero) {
  const variantes = new Set();
  const base = numero.toString().trim();
  variantes.add(base);
  variantes.add('0' + base);
  return [...variantes];
}

/* ===============================
   NUEVA FUNCIÓN ESTRICTA (Solo para Números)
================================*/
function encontrarMejorNumero(busqueda, opciones) {
  if (!busqueda) return null;
  const busqVal = busqueda.toString().trim();
  // Extraemos la raíz del número buscando, ej: "21"
  const raizBusq = busqVal.split(/[- A-Za-z]/)[0].replace(/[^0-9]/g, '');

  let mejorOpcion = null;
  let mejorMetodo = '';

  for (const opcion of opciones) {
    const textoWeb = opcion.texto.toString().trim();
    if (textoWeb.toLowerCase() === busqVal.toLowerCase()) {
      return { opcion, metodo: 'identidad_total' };
    }
    
    // Extraemos la raíz de la opción web
    const raizWeb = textoWeb.split(/[- A-Za-z]/)[0].replace(/[^0-9]/g, '');
    
    // Si las raíces no coinciden, ignoramos la opción (Evita que 21 seleccione 2-1)
    if (raizWeb !== raizBusq) continue;
    
    const normBusq = busqVal.replace(/[^0-9a-z]/gi, '').toLowerCase();
    const normWeb = textoWeb.replace(/[^0-9a-z]/gi, '').toLowerCase();
    if (normBusq === normWeb) {
      return { opcion, metodo: 'normalizado_match' };
    }
    if (!mejorOpcion) {
      mejorOpcion = opcion;
      mejorMetodo = 'raiz_match';
    }
  }
  return mejorOpcion ? { opcion: mejorOpcion, metodo: mejorMetodo } : null;
}

/* ===============================
   CLICK HUMANO
================================*/
async function clickHumano(page, element) {
  await element.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await delay(200);
  let box = await element.boundingBox();
  if (!box) {
    await page.evaluate(el => {
      el.style.display = 'block';
      el.style.visibility = 'visible';
    }, element);
    await delay(200);
    box = await element.boundingBox();
  }
  if (!box) {
    await element.evaluate(el => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click();
    });
    await delay(300);
    return;
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.down();
  await delay(50);
  await page.mouse.up();
  await delay(300);
}

/* ===============================
   SELECCIONAR
================================*/
async function seleccionar(page, wrapperIndex, texto) {
  console.log(`\n👉 [${wrapperIndex}] Seleccionando: "${texto}"`);
  const wrapperId = await page.evaluate((idx) => {
    const wrappers = document.querySelectorAll('.vscomp-ele-wrapper');
    return wrappers[idx] ? wrappers[idx].id : null;
  }, wrapperIndex);
  console.log(`   🔑 Wrapper ID: ${wrapperId}`);
  const wrappers = await page.$$('.vscomp-ele-wrapper');
  const wrapper  = wrappers[wrapperIndex];
  await clickHumano(page, wrapper);
  await delay(800);

  const estadoDropdown = await page.evaluate((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    
    if (!dropbox) {
      return { existe: false, abierto: false };
    }
    
    const estaAbierto = dropbox.style.display !== 'none';
    return { existe: true, abierto: estaAbierto, dropboxId: dropbox.id };
  }, wrapperId);

  console.log(`   📦 Dropbox existe: ${estadoDropdown.existe}, abierto: ${estadoDropdown.abierto}`);

  if (!estadoDropdown.abierto) {
    console.log("   🔄 Dropdown cerrado, forzando apertura...");
    await clickHumano(page, wrapper);
    await delay(800);
  }

  const searchInput = await page.evaluateHandle((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    return dropbox ? dropbox.querySelector('.vscomp-search-input') : null;
  }, wrapperId);
  const inputValido = await page.evaluate(el => el !== null, searchInput);
  console.log(`   🔍 inputValido: ${inputValido}`);
  
  if (inputValido) {
    const inputEl = searchInput.asElement();
    await clickHumano(page, inputEl);
    await delay(150);
    const box = await inputEl.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 3 });
    await delay(100);
    await page.keyboard.press('Backspace');
    await delay(100);
    await inputEl.type(normalizarTexto(texto), { delay: 80 });
    const valorEscrito = await page.evaluate(el => el.value, inputEl);
    console.log(`   ✏️ Valor en input: "${valorEscrito}"`);
    await delay(2000);
  } else {
    const globalInput = await page.$('.vscomp-search-input');
    if (globalInput) {
      await clickHumano(page, globalInput);
      await delay(150);
      await globalInput.type(normalizarTexto(texto), { delay: 80 });
      await delay(2000);
    }
  }
  await page.waitForFunction((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    if (!dropbox) return false;
    return dropbox.querySelectorAll('.vscomp-option').length > 0;
  }, { timeout: 6000 }, wrapperId).catch(() => console.log("   ⚠️ Timeout opciones"));
  
  await delay(500);
  const opcionesDisponibles = await page.evaluate((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    if (!dropbox) return [];
    return Array.from(dropbox.querySelectorAll('.vscomp-option')).map(op => ({
      value: op.getAttribute('data-value'),
      texto: op.querySelector('.vscomp-option-text')?.getAttribute('data-tooltip') ||
             op.querySelector('.vscomp-option-text')?.textContent?.trim() || ''
    }));
  }, wrapperId);
  console.log(`   📋 ${opcionesDisponibles.length} opciones`);
  
  if (opcionesDisponibles.length === 0) {
    await page.keyboard.press('Escape');
    await delay(300);
    return { ok: false, opcionesDisponibles: [] };
  }

  // AQUÍ INYECTAMOS LA LÓGICA ESTRICTA PARA NÚMEROS
  let coincidencia;
  if (wrapperIndex === 3) {
    coincidencia = encontrarMejorNumero(texto, opcionesDisponibles);
  } else {
    coincidencia = encontrarMejorCoincidencia(texto, opcionesDisponibles);
  }

  if (!coincidencia) {
    console.log(`   ❌ Sin coincidencia para "${texto}"`);
    await page.keyboard.press('Escape');
    await delay(300);
    return { ok: false, opcionesDisponibles };
  }
  
  console.log(`   🎯 "${coincidencia.opcion.texto}" [${coincidencia.metodo}]`);
  const resultado = await page.evaluate((wid, val) => {
    const wrapper = document.getElementById(wid);
    if (!wrapper) return 'wrapper no encontrado';
    if (typeof wrapper.setValue !== 'function') return 'setValue no es función';
    wrapper.setValue(val);
    return 'ok';
  }, wrapperId, coincidencia.opcion.value);
  console.log(`   📡 setValue: ${resultado}`);
  await delay(800);
  if (resultado !== 'ok') {
    await page.evaluate((wid, val) => {
      const suffix = wid.replace('vscomp-ele-wrapper-', '');
      const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
      if (!dropbox) return;
      const op = dropbox.querySelector(`.vscomp-option[data-value="${val}"]`);
      if (op) ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(ev =>
        op.dispatchEvent(new PointerEvent(ev, { bubbles: true, cancelable: true, pointerId: 1 }))
      );
    }, wrapperId, coincidencia.opcion.value);
    await delay(800);
  }
  const abierto = await page.evaluate((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const container = document.querySelector(`#vscomp-dropbox-container-${suffix} .vscomp-options-container`);
    return container ? window.getComputedStyle(container).display !== 'none' : false;
  }, wrapperId);
  if (abierto) { await page.keyboard.press('Escape'); await delay(300); }
  const confirmacion = await page.evaluate((wid) => {
    const wrapper = document.getElementById(wid);
    return {
      dataValue:    wrapper?.getAttribute('data-value') || '(vacío)',
      textoVisible: wrapper?.querySelector('.vscomp-value')?.textContent?.trim() || '(vacío)'
    };
  }, wrapperId);
  console.log(`   ✅ "${confirmacion.textoVisible}"`);
  await delay(400);
  return { ok: true, opcionesDisponibles, seleccionado: coincidencia.opcion.texto };
}

async function seleccionarOpcionExacta(page, wrapperIndex, opcion) {
  console.log(`\n👉 [${wrapperIndex}] Opción exacta: "${opcion.texto}"`);
  const wrapperId = await page.evaluate((idx) => {
    const wrappers = document.querySelectorAll('.vscomp-ele-wrapper');
    return wrappers[idx] ? wrappers[idx].id : null;
  }, wrapperIndex);
  const wrappers = await page.$$('.vscomp-ele-wrapper');
  await clickHumano(page, wrappers[wrapperIndex]);
  await delay(800);
  const resultado = await page.evaluate((wid, val) => {
    const wrapper = document.getElementById(wid);
    if (!wrapper || typeof wrapper.setValue !== 'function') return 'error';
    wrapper.setValue(val);
    return 'ok';
  }, wrapperId, opcion.value);
  await delay(800);
  if (resultado !== 'ok') {
    await page.evaluate((wid, val) => {
      const suffix = wid.replace('vscomp-ele-wrapper-', '');
      const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
      if (!dropbox) return;
      const op = dropbox.querySelector(`.vscomp-option[data-value="${val}"]`);
      if (op) ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(ev =>
        op.dispatchEvent(new PointerEvent(ev, { bubbles: true, cancelable: true, pointerId: 1 }))
      );
    }, wrapperId, opcion.value);
    await delay(800);
  }
  const abierto = await page.evaluate((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const container = document.querySelector(`#vscomp-dropbox-container-${suffix} .vscomp-options-container`);
    return container ? window.getComputedStyle(container).display !== 'none' : false;
  }, wrapperId);
  if (abierto) { await page.keyboard.press('Escape'); await delay(300); }
  const confirmacion = await page.evaluate((wid) => {
    const wrapper = document.getElementById(wid);
    return wrapper?.querySelector('.vscomp-value')?.textContent?.trim() || '(vacío)';
  }, wrapperId);
  console.log(`   ✅ "${confirmacion}"`);
  await delay(400);
  return confirmacion !== '(vacío)';
}

async function probarOpcionesDesplegable(page, terminoBusqueda, wrapperIndex, opcionesDesplegable) {
  const resultados = [];
  console.log(`\n🔎 "${terminoBusqueda}" — ${opcionesDesplegable.length} opciones`);
  for (let i = 0; i < opcionesDesplegable.length; i++) {
    const opcion = opcionesDesplegable[i];
    const ok = await seleccionarOpcionExacta(page, wrapperIndex, opcion);
    resultados.push({ opcion, exitoso: ok });
    if (ok) break;
  }
  console.log(`\n📊 RESUMEN "${terminoBusqueda}":`);
  resultados.forEach((r, i) => console.log(`   ${i + 1}. "${r.opcion.texto}": ${r.exitoso ? '✅' : '❌'}`));
  const exitosa = resultados.find(r => r.exitoso);
  return exitosa ? exitosa.opcion : null;
}

/* ===============================
   DEPARTAMENTO
================================*/
async function manejarDepartamento(page, depto) {
  console.log("\n🔍 Verificando campo departamento...");
  
  if (!depto || depto.toString().trim() === '') {
    console.log("   ℹ️ Sin depto — continuando");
    return false;
  }
  
  const wrapperIndex = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.vscomp-ele-wrapper');
    for (let i = 0; i < wrappers.length; i++) {
      const valueDiv = wrappers[i].querySelector('.vscomp-value');
      const tooltip = valueDiv?.getAttribute('data-tooltip') || '';
      const text = valueDiv?.textContent?.trim() || '';
      if (tooltip.includes('Ej. 2912') || text.includes('Ej. 2912')) return i;
    }
    return -1;
  });
  
  if (wrapperIndex === -1) {
    console.log("   ℹ️ No se encontró campo depto");
    return false;
  }
  
  console.log(`   🏢 Depto encontrado en wrapper ${wrapperIndex}`);
  
  const wrapperId = await page.evaluate((idx) => {
    const wrappers = document.querySelectorAll('.vscomp-ele-wrapper');
    return wrappers[idx] ? wrappers[idx].id : null;
  }, wrapperIndex);
  
  const wrappers = await page.$$('.vscomp-ele-wrapper');
  
  // Abrir dropdown
  await clickHumano(page, wrappers[wrapperIndex]);
  await delay(800);
  
  // Buscar y escribir en el input de búsqueda
  const searchInput = await page.evaluateHandle((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    return dropbox ? dropbox.querySelector('.vscomp-search-input') : null;
  }, wrapperId);
  
  if (searchInput) {
    const inputEl = searchInput.asElement();
    await clickHumano(page, inputEl);
    await delay(150);
    const box = await inputEl.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 3 });
    await delay(100);
    await page.keyboard.press('Backspace');
    await delay(100);
    await inputEl.type(depto.toString(), { delay: 80 });
    await delay(2000);
  }
  
  // Esperar a que aparezcan las opciones
  await page.waitForFunction((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    if (!dropbox) return false;
    return dropbox.querySelectorAll('.vscomp-option').length > 0;
  }, { timeout: 5000 }, wrapperId).catch(() => console.log("   ⚠️ Timeout opciones"));
  
  await delay(500);
  
  const opciones = await page.evaluate((wid) => {
    const suffix = wid.replace('vscomp-ele-wrapper-', '');
    const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
    if (!dropbox) return [];
    return Array.from(dropbox.querySelectorAll('.vscomp-option')).map(op => ({
      value: op.getAttribute('data-value'),
      texto: op.querySelector('.vscomp-option-text')?.textContent?.trim() || ''
    }));
  }, wrapperId);
  
  console.log(`   📋 ${opciones.length} opciones de depto`);
  
  if (opciones.length === 0) {
    await page.keyboard.press('Escape');
    return false;
  }
  
  const coincidencia = encontrarMejorCoincidencia(depto.toString(), opciones);
  if (!coincidencia) {
    console.log(`   ❌ No se encontró coincidencia para "${depto}"`);
    await page.keyboard.press('Escape');
    return false;
  }
  
  console.log(`   🎯 Seleccionando: "${coincidencia.opcion.texto}"`);
  
  // Intentar con setValue primero
  const resultado = await page.evaluate((wid, val) => {
    const wrapper = document.getElementById(wid);
    if (wrapper && typeof wrapper.setValue === 'function') {
      wrapper.setValue(val);
      return 'ok';
    }
    return 'error';
  }, wrapperId, coincidencia.opcion.value);
  
  await delay(800);
  
  // Si falló setValue, hacer click manual en la opción
  if (resultado !== 'ok') {
    console.log("   🔄 Intentando click manual en la opción");
    await page.evaluate((wid, val) => {
      const suffix = wid.replace('vscomp-ele-wrapper-', '');
      const dropbox = document.getElementById(`vscomp-dropbox-container-${suffix}`);
      if (!dropbox) return;
      const opcion = dropbox.querySelector(`.vscomp-option[data-value="${val}"]`);
      if (opcion) {
        // Forzar click con múltiples eventos
        opcion.scrollIntoView({ block: 'center' });
        opcion.click();
        opcion.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        opcion.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        opcion.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }
    }, wrapperId, coincidencia.opcion.value);
    await delay(800);
  }
  
  // Verificar que se seleccionó
  const confirmacion = await page.evaluate((wid) => {
    const wrapper = document.getElementById(wid);
    return wrapper?.querySelector('.vscomp-value')?.textContent?.trim() || '(vacío)';
  }, wrapperId);
  
  console.log(`   ✅ Depto seleccionado: "${confirmacion}"`);
  
  // Cerrar dropdown si quedó abierto
  await page.keyboard.press('Escape');
  await delay(300);
  
  return confirmacion !== '(vacío)';
}

/* ===============================
   LEER PANTALLA
================================*/
async function leerPantalla(page, contexto) {
  console.log(`\n🔎 LEYENDO [${contexto}]...`);
  const screenshotPath = `diagnostico_${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const info = await page.evaluate(() => {
    const url = window.location.href;
    const errores = [];
    ['[class*="error"]','[class*="alert"]','[class*="warning"]','.vscomp-no-options','[role="alert"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const txt = el.innerText?.trim();
        const visible = el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
        if (visible && txt && txt.length > 3) errores.push(`[${sel}] ${txt}`);
      });
    });
    const estadoWrappers = Array.from(document.querySelectorAll('.vscomp-ele-wrapper')).map((w, i) => ({
      index: i,
      valorActual: w.querySelector('.vscomp-value')?.textContent?.trim() || '(vacío)',
      dataValue: w.getAttribute('data-value') || '(vacío)',
      disabled: w.classList.contains('disabled') || w.hasAttribute('disabled')
    }));
    return { url, errores, estadoWrappers };
  });
  console.log(`📍 URL: ${info.url}`);
  info.estadoWrappers.forEach(w =>
    console.log(`   [${w.index}] ${w.disabled ? '🔒' : '✅'} "${w.valorActual}"`));
  if (info.errores.length > 0) [...new Set(info.errores)].forEach(e => console.log(`   ⚠️ ${e}`));
  console.log(`📸 ${screenshotPath}`);
  return { ...info, screenshotPath };
}

/* ===============================
   DETECTAR MODALES
================================*/
async function detectarModal(page) {
  console.log("\n🔍 Verificando modales...");
  await delay(2000);
  const modal = await page.evaluate(() => {
    const selectoresModal = [
      '[class*="modal"]','[class*="Modal"]','[class*="popup"]','[class*="dialog"]',
      '[role="dialog"]','[role="alertdialog"]','[class*="toast"]','[class*="aviso"]',
      '[aria-modal="true"]','.swal2-container','[class*="swal"]','[class*="confirm"]'
    ];
    const palabrasServicioActivo = [
      'ya posee','ya tiene','servicio activo','cliente entel','ya es cliente',
      'plan activo','contrato vigente','ya cuenta','fibra activa','internet activo',
      'ya dispone','tiene contratado','servicio existente'
    ];
    const palabrasError = [
      'error','problema','no es posible','no podemos','intente nuevamente',
      'ocurrió un error','fuera de servicio','mantencion','mantención'
    ];
    const palabrasSinCobertura = [
      'sin cobertura','no hay cobertura','no encontramos','no tenemos cobertura',
      'fuera de cobertura','no llegamos','no disponemos'
    ];
    let resultado = null;
    for (const sel of selectoresModal) {
      for (const el of document.querySelectorAll(sel)) {
        const visible = el.offsetParent !== null &&
                        window.getComputedStyle(el).display !== 'none' &&
                        window.getComputedStyle(el).visibility !== 'hidden' &&
                        el.offsetHeight > 0;
        if (!visible) continue;
        const texto = (el.innerText || '').trim().toLowerCase();
        if (texto.length < 5) continue;
        let tipo = 'aviso_generico';
        if (palabrasServicioActivo.some(p => texto.includes(p)))    tipo = 'servicio_activo';
        else if (palabrasError.some(p => texto.includes(p)))        tipo = 'error';
        else if (palabrasSinCobertura.some(p => texto.includes(p))) tipo = 'sin_cobertura';
        const botonesModal = Array.from(el.querySelectorAll('button,[role="button"],a'))
          .map(b => b.innerText?.trim()).filter(Boolean);
        resultado = { tipo, textoCompleto: el.innerText?.trim().substring(0, 500), botones: botonesModal };
        if (tipo === 'servicio_activo' || tipo === 'error') break;
      }
      if (resultado && (resultado.tipo === 'servicio_activo' || resultado.tipo === 'error')) break;
    }
    return resultado;
  });
  if (!modal) { console.log("   ✅ Sin modales"); return null; }
  const screenshotPath = `modal_${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`🚨 MODAL: ${modal.tipo.toUpperCase()} — "${modal.textoCompleto}"`);
  let mensajeEnvio = '';
  switch (modal.tipo) {
    case 'servicio_activo': mensajeEnvio = `⚠️ Esta dirección ya posee servicio Entel activo.\n\n📄 "${modal.textoCompleto}"`; break;
    case 'sin_cobertura':   mensajeEnvio = `❌ Sin cobertura.\n\n📄 "${modal.textoCompleto}"\n\nVerifica la dirección e inténtalo nuevamente.`; break;
    case 'error':           mensajeEnvio = `❌ Error del sistema.\n\n📄 "${modal.textoCompleto}"\n\nIntenta nuevamente más tarde.`; break;
    default:                mensajeEnvio = `⚠️ Aviso del sistema.\n\n📄 "${modal.textoCompleto}"`;
  }
  const cerrado = await page.evaluate(() => {
    const botonesOk = ['aceptar','ok','cerrar','close','entendido','continuar','volver'];
    for (const btn of document.querySelectorAll('button,[role="button"]')) {
      const txt = (btn.innerText || '').trim().toLowerCase();
      const visible = btn.offsetParent !== null && window.getComputedStyle(btn).display !== 'none';
      if (visible && botonesOk.some(b => txt.includes(b))) { btn.click(); return txt; }
    }
    return null;
  });
  if (!cerrado) await page.keyboard.press('Escape');
  await delay(1000);
  return { tipo: modal.tipo, texto: modal.textoCompleto, mensajeEnvio, screenshotPath };
}

/* ===============================
   FACTIBILIDAD
================================*/
async function checkFactibilidad(page, direccion) {
  console.log("\n⏳ Verificando factibilidad...");
  try { await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }); }
  catch (e) { await delay(4000); }
  const urlActual = page.url();
  console.log(`   🔗 URL: ${urlActual}`);
  const hayFactibilidad = urlActual.includes("PlanSelection") ||
                          urlActual.includes("plan") ||
                          urlActual.includes("seleccion");
 const screenshotPath = `factibilidad_${Date.now()}.png`;
await delay(2000);  // ← LÍNEA 1: espera 3 segundos
await page.screenshot({ path: screenshotPath, fullPage: true });
  if (hayFactibilidad) {
    const info = await page.evaluate(() => {
      const textos = [];
      ['h1','h2','h3','[class*="plan"]','[class*="precio"]','[class*="mbps"]','[class*="card"]'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const txt = el.innerText?.trim();
          if (txt && txt.length > 2 && txt.length < 500) textos.push(txt);
        });
      });
      return [...new Set(textos)].slice(0, 20).join('\n');
    });
    return { factible: true, screenshotPath, direccion, info,
      mensaje: `✅ ¡Hay factibilidad para ${direccion}!\nRevisa el screenshot con los planes disponibles.` };
  } else {
    const mensajePagina = await page.evaluate(() => {
      for (const sel of ['[class*="error"]','[class*="alert"]','h1','h2','p']) {
        const txt = document.querySelector(sel)?.innerText?.trim();
        if (txt && txt.length > 5) return txt;
      }
      return null;
    });
    return { factible: false, screenshotPath, direccion, mensajePagina,
      mensaje: `❌ Sin factibilidad para ${direccion}.\nPor favor verifica la dirección e inténtalo nuevamente.` };
  }
}

/* ===============================
   INTENTAR COMBINACIÓN
================================*/
async function intentarCombinacion(page, region, comuna, calle, numero, depto) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🔄 calle="${calle}" | numero="${numero}" | depto="${depto || '-'}"`);
  await page.goto('https://miperfil.entel.cl/Web_entel_TomaPedido_EU/factibilidad',
    { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.vscomp-ele-wrapper', { timeout: 10000 });
  await delay(1000);

  const resRegion = await seleccionar(page, 0, region);
  if (!resRegion.ok) { await leerPantalla(page, 'FALLO REGIÓN'); return null; }
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
  await delay(600);

  const resComuna = await seleccionar(page, 1, comuna);
  if (!resComuna.ok) { await leerPantalla(page, 'FALLO COMUNA'); return null; }
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
  await delay(600);




  const resCalle = await seleccionar(page, 2, calle);        ///// NO MODIFICAR    RESUELVE  2264-c3
if (!resCalle.ok) { 

  // ── NUEVO: detectar sufijo en calle y reintentar ──
  const matchSufijo = calle.match(/(-[A-Za-z0-9]+)/);     //////////   NO MODIFICAR  ///////////
  if (matchSufijo) {                                      ///////////////////////////////////////7
    const calleCorregida = calle.replace(matchSufijo[1], '').trim(); //////////////////////////////////
    const numeroCorregido = numero + matchSufijo[1];                /////////////////////////////////////7
    console.log(`   🔧 Reintentando con calle="${calleCorregida}" numero="${numeroCorregido}"`);   /////////
    return await intentarCombinacion(page, region, comuna, calleCorregida, numeroCorregido, depto);  ///////////
  }    ///////////////////////////////////////////////////////////////////////////////////////////////////////////
  // ─────────────────────────────────────────────────

  await leerPantalla(page, `FALLO CALLE: ${calle}`); 
  return {
    factible: false,
    falloCalle: true,
    sugerenciasCalle: resCalle.opcionesDisponibles ? resCalle.opcionesDisponibles.map(op => op.texto) : []
  };
}

  // OMITIDO probarOpcionesDesplegable para no arruinar la selección original correcta
  await page.waitForNetworkIdle({ timeout: 8000 }).catch(() => {});
  await delay(600);

  const resNumero = await seleccionar(page, 3, numero);
  if (!resNumero.ok) { 
    await leerPantalla(page, `FALLO NÚMERO: ${numero}`); 
    // Retornamos un objeto indicando fallo de número, pero extrayendo las sugerencias si las hay
    return {
      factible: false,
      falloNumero: true,
      sugerencias: resNumero.opcionesDisponibles ? resNumero.opcionesDisponibles.map(op => op.texto) : []
    }; 
  }
  const variantesNumero = resNumero.opcionesDisponibles?.map(op => op.texto) || [];


  // OMITIDO probarOpcionesDesplegable para que se quede con la función estricta encontrarMejorNumero
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
  await delay(800);

// ==========================================================================================
// ⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️⬇️
// 🛑 AQUI TERMINA EXACTAMENTE LA SELECCIÓN DEL NÚMERO CORRECTO DE CALLE.
// 🛑 A PARTIR DE ESTA LÍNEA, COMIENZA EL PROCESO DEL DEPARTAMENTO Y EL BOTÓN VERIFICAR.
// ⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️⬆️
// ==========================================================================================

  await manejarDepartamento(page, depto);
  await delay(500);

  await leerPantalla(page, `PRE-VERIFICAR [${calle} ${numero}]`);

  console.log("\n🔍 Buscando botón Verificar...");
  const botones = await page.$$('button');
  for (const btn of botones) {
    const t = await page.evaluate(el => el.textContent.trim(), btn);
    if (t && t.toLowerCase().includes("verificar")) {
      console.log("✅ Click en Verificar");
      await clickHumano(page, btn);
      break;
    }
  }


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////7
await delay(7000);  // ← después de este delay

// 🔥 AQUÍ SE COLOCA EL BLOQUE
// REEMPLAZAR el bloque problemático por este:
const modalServicioActivo = await page.evaluate(() => {
  const spans = document.querySelectorAll('h5 span, h5');
  for (const el of spans) {
    if (el.innerText?.toLowerCase().includes('esta dirección ya tiene un servicio')) {
      return true;
    }
  }
  return false;
});

if (modalServicioActivo) {
  const path = `servicio_activo_${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  return { bloqueado: true, modal: { tipo: 'servicio_activo', mensajeEnvio: '⚠️ Esta dirección ya tiene un servicio Entel activo.', screenshotPath: path } };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



  const modalDetectado = await detectarModal(page);
  if (modalDetectado && (modalDetectado.tipo === 'servicio_activo' || modalDetectado.tipo === 'error'))
    return { bloqueado: true, modal: modalDetectado };

  const resultadoFactibilidad = await checkFactibilidad(page, `${calle} ${numero}${depto ? ' depto ' + depto : ''}, ${comuna}`);
  
  // Pegar las opciones sugeridas al objeto resultado si todo salió bien hasta aquí (pero no hay cobertura)
  if (resNumero && resNumero.opcionesDisponibles) {
    resultadoFactibilidad.sugerencias = resNumero.opcionesDisponibles.map(op => op.texto);
  }
  
  // 🔥 AGREGAR ESTA LÍNEA
resultadoFactibilidad.variantesNumero = variantesNumero;
  return resultadoFactibilidad;
}

/* ===============================
   PROCESAR DIRECCIÓN
================================*/
async function procesarDireccion(textoDireccion, enviarMensaje, enviarFoto) {
  console.log(`\n📨 Procesando: "${textoDireccion}"`);
  const dir = parsearDireccion(textoDireccion);
  console.log(`\n📍 Parseada:`, dir);

  await enviarMensaje(
    `⏳ Procesando consulta para:\n📍 ${textoDireccion}\n\n` +
    `• Calle: ${dir.calle}\n` +
    `• Número: ${dir.numero}\n` +
    `• Comuna: ${dir.comuna}\n` +
    `• Depto: ${dir.depto || '-'}\n\n` +
    `_Esto puede tomar unos minutos..._`
  );

  if (!dir.calle || !dir.numero) {
    await enviarMensaje(
      `⚠️ No pude identificar la dirección completa.\n\n` +
      `Por favor envía en formato:\n*Nombre Calle 123, Comuna*\n\n` +
      `Ejemplo:\n_Av\\. Providencia 1234, Providencia_`
    );
    return;
  }
const browser = await puppeteer.launch({
  headless: true,
  slowMo: 10,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: [
    '--window-size=1920,1080',      // ← reemplaza --start-maximized
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--ignore-certificate-errors',
    '--disable-dev-shm-usage',
  ],
  defaultViewport: { width: 1920, height: 1080 }  // ← en vez de null
});

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const variacionesNumero = generarVariacionesNumero(dir.numero);
  let resultadoFinal     = null;
  let combinacionExitosa = null;
  let totalIntentos      = 0;
  let sugerenciasOriginales = []; // Aquí guardaremos solo las sugerencias del Intento 1
  let sugerenciasCalleFinal = [];  // ← LÍNEA NUEVA

  try {
    externo:
    for (const numero of variacionesNumero) {
      totalIntentos++;
      console.log(`\n🔁 Intento ${totalIntentos}/${variacionesNumero.length} — número: "${numero}"`);
      const resultado = await intentarCombinacion(
  page, dir.region, dir.comuna, dir.calle, numero, dir.depto
);

if (resultado) {
  resultadoFinal = resultado;
  
  // 🆕 CAPTURAR FALLO DE CALLE
  if (resultado.falloCalle) {
    sugerenciasCalleFinal = resultado.sugerenciasCalle || [];
    break externo; // Salir, no tiene sentido probar más números
  }
  
  if (totalIntentos === 1 && resultado.sugerencias) {
    sugerenciasOriginales = resultado.sugerencias;
  }
}

      if (resultado?.bloqueado) {
        resultadoFinal = resultado.modal;
        combinacionExitosa = { ...dir, numero };
        break externo;
      }
      if (resultado?.factible === true) {
        resultadoFinal = resultado;
        combinacionExitosa = { ...dir, numero };
        break externo;
      }
      await delay(1000);
    }

    // Enviar resultado
    if (resultadoFinal?.tipo === 'servicio_activo') {
      await enviarMensaje(resultadoFinal.mensajeEnvio);
      if (resultadoFinal.screenshotPath && fs.existsSync(resultadoFinal.screenshotPath))
        await enviarFoto(resultadoFinal.screenshotPath, '📸 Screenshot del aviso');



/////////////////////////////////////////////////////////////
} else if (resultadoFinal?.factible === true) {
  const varianteUsada = combinacionExitosa?.numero || dir.numero;
  const variantesLista = resultadoFinal.variantesNumero?.length > 1
    ? resultadoFinal.variantesNumero.slice(0, 5).join(' • ')
    : null;

  let mensaje = `✅ *Hay factibilidad* ✅\n\n` +
    `📍 ${dir.calle} ${varianteUsada}${dir.depto ? ', Depto ' + dir.depto : ''}, ${dir.comuna}\n\n` +
    `◾ *Ingresaste:* ${dir.calle} ${dir.numero}\n` +
    `◾ *Se usó:* ${varianteUsada}\n` +
    (variantesLista ? `◾ *Opciones:* ${variantesLista}\n` : '') +
    `◾ *Entel Fibra disponible*`;

  await enviarMensaje(mensaje);
  // Enviar la imagen local entel.png
  const rutaImagen = path.join(__dirname, 'imagenes', 'entel.png');
  if (fs.existsSync(rutaImagen)) {
    await enviarFoto(rutaImagen, '🎉 ¡Entel Fibra disponible! 🚀');
  } else {
    await enviarMensaje('⚠️ No se encontró la imagen promocional.');
  }
  
  // Opcional: también enviar el screenshot si quieres
  if (resultadoFinal.screenshotPath && fs.existsSync(resultadoFinal.screenshotPath))
    await enviarFoto(resultadoFinal.screenshotPath, '📸 Screenshot factibilidad');

  //////////////////////////////////////////////////////////////////

    } else {
      let textoSugerencias = "";

// Sugerencias de CALLE
if (sugerenciasCalleFinal.length > 0) {
  const unicas = [...new Set(sugerenciasCalleFinal)];
  const primerasVariantes = unicas.slice(0, 6).join('\n• ');
  textoSugerencias = '\n\n🛣️ *Variantes de calle encontradas:*\n• ' + primerasVariantes + '\n\n_Intenta enviar la dirección usando el nombre exacto de la calle._';
} 
// Sugerencias de NÚMERO
else if (sugerenciasOriginales && sugerenciasOriginales.length > 0) {
  const similares = sugerenciasOriginales.filter(s => s.includes(dir.numero) && s !== dir.numero);
  if (similares.length > 0) {
    const variantesNumero = similares.slice(0, 5).join('\n• ');
    textoSugerencias = '\n\n💡 *Variantes de número encontradas:*\n• ' + variantesNumero + '\n\n_Intenta enviar la dirección usando alguna de estas variantes._';
  }
}

      await enviarMensaje(
        `❌ Sin factibilidad para ${dir.calle} ${dir.numero}` +
        `${dir.depto ? ' depto ' + dir.depto : ''}, ${dir.comuna}.\n\n` +
        `Se probaron ${totalIntentos} variación(es).` + textoSugerencias
      );

      //// FOTO SIN COBERTURA 
      const rutaImagen = path.join(__dirname, 'imagenes', 'sin_cobertura.png');
if (fs.existsSync(rutaImagen)) await enviarFoto(rutaImagen, '📭 Sin cobertura en tu sector');

      
      if (resultadoFinal?.screenshotPath && fs.existsSync(resultadoFinal.screenshotPath))
        await enviarFoto(resultadoFinal.screenshotPath, '📸 Screenshot');
    }

  } catch (err) {
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.error('❌ Error:', err.message);
    const errorPath = `error_${Date.now()}.png`;
    await page.screenshot({ path: errorPath, fullPage: true }).catch(() => {});
    await enviarMensaje(
      `❌ Error al verificar ${dir.calle} ${dir.numero}, ${dir.comuna}.\n\n` +
      `Por favor verifica la dirección e inténtalo nuevamente.\n\n` +
      `🔧 ${err.message}`
    );

    // 🔽🔽🔽 SOLO AGREGAR ESTAS 3 LÍNEAS 🔽🔽🔽
    const rutaImagen = path.join(__dirname, 'imagenes', 'direccion_no_encontrada.png');
    if (fs.existsSync(rutaImagen)) await enviarFoto(rutaImagen, '📍 Dirección no encontrada');

    if (fs.existsSync(errorPath))
      await enviarFoto(errorPath, '📸 Screenshot del error');
  } finally {
    await browser.close();
  }
}

/* ===============================
   BOT TELEGRAM
================================*/
function iniciarTelegram() {
  console.log("🤖 Iniciando bot Telegram...");

  const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, {
    polling: {
      interval: 1000,
      autoStart: false,
      params: { timeout: 10 }
    }
  });





  bot.deleteWebHook()
    .then(() => {
      console.log("✅ Webhook limpiado");
      return bot.startPolling();
    })
    .then(() => {
      console.log("✅ Bot Telegram activo — esperando mensajes...");
    })
    .catch(err => console.error("❌ Error al iniciar:", err.message));






  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `👋 ¡Hola! Soy el bot de factibilidad Entel de FreeWork.\n\n` +
`📡 Envíame una dirección en texto libre y verificaré si existe cobertura.\n\n` +
`⚠️ Importante:\n` +
`La comuna debe ir siempre al final, después de una coma (,)\n\n` +
`📝 Ejemplos:\n` +
`• _Av. Providencia 1234, Providencia_\n` +
`• _Circunvalación 558 depto 302, Santiago_\n` +
`• _Pasaje Los Aromos 45, Maipú_`,
      { parse_mode: 'MarkdownV2' }
    )

  const rutaImagen = path.join(__dirname, 'imagenes', 'bienvenida.png');
  if (fs.existsSync(rutaImagen)) {
    bot.sendPhoto(msg.chat.id, fs.createReadStream(rutaImagen), { 
      caption: '🤖 ¡Bienvenido al Bot de Factibilidad Entel!' 
    });
  }
});

bot.onText(/\/miid/, (msg) => {
  const id = msg.from.id;
  const nombre = msg.from.first_name || 'Usuario';
  
  bot.sendMessage(msg.chat.id,
    `👤 *${nombre}*\n\n` +
    `🆔 *Tu ID es:*\n\`${id}\`\n\n` +
    `📩 Envía este número al administrador para que te habilite.`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return;
  const chatId = msg.chat.id;
  const texto  = msg.text?.trim();
  if (!texto) return;

  const userId = msg.from.id;
  console.log('ID enviado:', userId); // ← AQUÍ
  const permiso = await verificarPermiso(userId, null, 'consultar');
  console.log('Respuesta:', JSON.stringify(permiso)); // ← Y AQUÍ
  if (!permiso.permitido) {
    await bot.sendMessage(chatId, `❌ ${permiso.mensaje}`);
    return;
  }
  // 🔐 FIN VERIFICACIÓN

    // Cola simple — evitar procesar mientras ya hay una consulta activa
    const enviarMensaje = async (txt) => {
      try {
        await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
      } catch (e) {
        // Si falla Markdown intentar sin formato
        await bot.sendMessage(chatId, txt).catch(() => {});
      }
    };

   const enviarFoto = async (path, caption) => {
  try {
    await bot.sendPhoto(chatId, fs.createReadStream(path), { caption });
    
    // Borrar solo si NO es de la carpeta imagenes
    if (!path.includes('imagenes') && fs.existsSync(path)) {
      fs.unlink(path, () => {});
    }
  } catch (e) {
    console.error('❌ Error enviando foto:', e.message);
  }
};

       await procesarDireccion(texto, enviarMensaje, enviarFoto);
  
  // 📊 Mostrar consumo actualizado después de cada consulta
  const permisoActualizado = await verificarPermiso(msg.from.id, null, 'consultar');
  if (permisoActualizado.estadisticas) {
    const s = permisoActualizado.estadisticas;
    
    const usado = s.dia.usadas;
    const maximo = s.dia.maximo;
    const porcentajeUsado = Math.round((usado / maximo) * 100);
    const barraUsado = '▰'.repeat(Math.floor(porcentajeUsado / 5)) + '▱'.repeat(20 - Math.floor(porcentajeUsado / 5));
    
    const quedaMsg = 
      `📊 *Consumo*\n\n` +
      `📅 \`${barraUsado}\` ${s.dia.restantes} de ${maximo}\n` +
      `📆 ${s.semana.restantes} esta semana`;
        `💡 *Recuerda:* Por cada *venta instalada* se te cargará *más cupo de consultas* automáticamente.`;
    
    await bot.sendMessage(chatId, quedaMsg, { parse_mode: 'Markdown' });
  }
});


bot.on('polling_error', (err) => {
  console.error(`❌ Telegram error: ${err.message}`);
  if (err.message.includes('409')) {
    console.log("⚠️ Otra instancia corriendo — cerrando...");
    process.exit(1);
  }
});
}

/* ===============================
   MAIN
================================*/
async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🚀 Bot Factibilidad Entel — Telegram`);
  console.log(`${"═".repeat(60)}\n`);
  iniciarTelegram();
}

process.on('unhandledRejection', err => console.error('❌ Error no manejado:', err));
main();


////////////////