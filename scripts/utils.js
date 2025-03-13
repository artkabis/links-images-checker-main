/**
 * Fonctions utilitaires pour l'extension Link & Image Checker
 * Version améliorée et étendue
 * @module utils
 */

/**
 * Liste des protocoles spéciaux que nous reconnaissons
 */
export const SPECIAL_PROTOCOLS = [
  'mailto:',
  'tel:',
  'sms:',
  'whatsapp:',
  'skype:',
  'market:',
  'intent:',
  'spotify:',
  'steam:',
  'discord:',
  'slack:',
  'viber:',
  'javascript:',
  'file:',
  'ftp:',
  'sftp:',
  'news:',
  'nntp:',
  'rtmp:',
  'rtsp:',
  'mms:',
  'magnet:',
  'webcal:',
  'fb-messenger:',
  'tg:',        // Telegram
  'itms:',
  'itms-apps:',
  'maps:',
  'geo:',
  'matrix:',    // Matrix
  'zoomus:',    // Zoom
  'teams:'      // Microsoft Teams
];

/**
 * Liste des domaines connus pour être problématiques lors de la vérification
 * en raison de protections anti-scraping, pare-feu, etc.
 */
export const PROBLEMATIC_DOMAINS = [
  // Réseaux sociaux
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'twitter.com',
  'x.com',
  'threads.net',
  'reddit.com',
  'tiktok.com',
  'pinterest.com',
  'tumblr.com',
  
  // Sites avec protection anti-bot
  'cloudflare.com',
  'akamai.com',
  'imperva.com',
  'recaptcha.net',
  'hcaptcha.com',
  
  // Sites e-commerce et streaming
  'amazon.com',
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'hbomax.com',
  'primevideo.com',
  'shopify.com',
  
  // Sites d'information avec paywall
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'washingtonpost.com',
  'medium.com',
  
  // Autres
  'quora.com',
  'glassdoor.com',
  'indeed.com',
  'typeform.com',
  'microsoft.com',
  'apple.com',
  'google.com'
];

/**
 * Types MIME d'images communs
 */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/avif',
  'image/heic',
  'image/heif'
];

/**
 * Extensions de fichiers images communes
 */
export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', 
  '.bmp', '.ico', '.tiff', '.tif', '.avif', '.heic'
];

/**
 * Normalise une URL
 * @param {string} url - URL à normaliser
 * @returns {string} - URL normalisée
 */
export function normalizeUrl(url) {
  try {
    // Gestion des fragments d'ancre uniquement
    if (url.startsWith('#')) {
      return url;
    }

    // Gestion des protocoles spéciaux
    for (const protocol of SPECIAL_PROTOCOLS) {
      if (url.toLowerCase().startsWith(protocol)) {
        return url; // Retourner tel quel pour les protocoles spéciaux
      }
    }

    // Gestion des URLs sans protocole
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      url = 'https://' + url;
    }

    // Pour les URLs de données, retourner telles quelles
    if (url.startsWith('data:')) {
      return url;
    }
    
    // Nettoyer les doubles slashes dans le chemin (après le domaine)
    const urlParts = url.split('://');
    if (urlParts.length >= 2) {
      const protocol = urlParts[0];
      let rest = urlParts.slice(1).join('://');
      
      // Trouver le premier slash après le domaine
      const domainEndIndex = rest.indexOf('/');
      if (domainEndIndex > 0) {
        const domain = rest.substring(0, domainEndIndex);
        let path = rest.substring(domainEndIndex);
        
        // Remplacer les doubles slashes par un seul dans le chemin
        while (path.includes('//')) {
          path = path.replace('//', '/');
        }
        
        rest = domain + path;
      }
      
      url = protocol + '://' + rest;
    }

    const urlObj = new URL(url);
    
    // Gérer spécifiquement les URLs de sites problématiques
    const hostname = urlObj.hostname.toLowerCase();
    
    // Facebook et autres sites avec des chemins problématiques
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
      // Nettoyer les doubles slashes dans le chemin de Facebook
      if (urlObj.pathname.includes('//')) {
        urlObj.pathname = urlObj.pathname.replace(/\/+/g, '/');
      }
      
      // Gérer les identifiants numériques longs dans les URLs Facebook
      if (urlObj.pathname.match(/\/\d{10,}/)) {
        // C'est probablement un ID valide, ne pas toucher davantage
      }
    }
    
    // Twitter/X URLs
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      // Assurer que les paramètres de requête problématiques sont préservés
      if (urlObj.searchParams.has('s') || urlObj.searchParams.has('t')) {
        // Ces paramètres sont importants pour Twitter, ne pas les modifier
      }
    }
    
    // Supprimer le slash final s'il est seul
    if (urlObj.pathname === '/') {
      urlObj.pathname = '';
    }
    
    // Supprimer les ports par défaut
    if (
      (urlObj.protocol === 'http:' && urlObj.port === '80') ||
      (urlObj.protocol === 'https:' && urlObj.port === '443')
    ) {
      urlObj.port = '';
    }
    
    return urlObj.toString();
  } catch (error) {
    // Si l'URL est invalide, retourner l'originale
    return url;
  }
}

/**
 * Vérifie si une chaîne est une URL valide ou un protocole spécial
 * @param {string} url - URL à vérifier
 * @returns {boolean} - True si valide, false sinon
 */
export function isValidUrl(url) {
  // Gestion des fragments d'ancre uniquement
  if (url.startsWith('#')) {
    return true; // Considéré comme valide dans le contexte d'une page
  }
  
  // Vérifier les protocoles spéciaux
  for (const protocol of SPECIAL_PROTOCOLS) {
    if (url.toLowerCase().startsWith(protocol)) {
      return true;
    }
  }
  
  // Vérifier les URLs de données
  if (url.startsWith('data:')) {
    return url.includes(';base64,') || url.includes(',');
  }
  
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Détermine si une URL est vérifiable via HTTP/HTTPS
 * @param {string} url - URL à vérifier
 * @returns {boolean} - True si l'URL peut être vérifiée via HTTP/HTTPS
 */
export function isCheckableUrl(url) {
  if (!url) return false;
  
  // Fragments d'ancre uniquement - pas vérifiables isolément
  if (url.startsWith('#')) {
    return false;
  }
  
  // Vérifier les protocoles spéciaux
  for (const protocol of SPECIAL_PROTOCOLS) {
    if (url.toLowerCase().startsWith(protocol)) {
      return false;
    }
  }
  
  try {
    const normalized = normalizeUrl(url);
    const urlObj = new URL(normalized);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Vérifie si un domaine est connu pour être problématique lors des vérifications
 * @param {string} url - URL à vérifier
 * @returns {boolean} - True si le domaine est problématique
 */
export function isProblematicDomain(url) {
  try {
    // Si l'URL est une URL de données, ce n'est pas un domaine problématique
    if (url.startsWith('data:')) {
      return false;
    }
    
    const domain = extractDomain(url).toLowerCase();
    if (!domain) return false;
    
    return PROBLEMATIC_DOMAINS.some(problematicDomain => 
      domain === problematicDomain || domain.endsWith('.' + problematicDomain)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Renvoie le nom du domaine problématique s'il est trouvé
 * @param {string} url - URL à vérifier
 * @returns {string|null} - Nom du domaine problématique ou null si aucun
 */
export function getProblematicDomainName(url) {
  try {
    // Si l'URL est une URL de données, ce n'est pas un domaine problématique
    if (url.startsWith('data:')) {
      return null;
    }
    
    const domain = extractDomain(url).toLowerCase();
    if (!domain) return null;
    
    for (const problematicDomain of PROBLEMATIC_DOMAINS) {
      if (domain === problematicDomain || domain.endsWith('.' + problematicDomain)) {
        return problematicDomain;
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Extrait le domaine d'une URL
 * @param {string} url - URL pour extraire le domaine
 * @returns {string} - Domaine extrait ou chaîne vide si invalide
 */
export function extractDomain(url) {
  try {
    // Si c'est un fragment d'ancre ou un protocole spécial, retourner vide
    if (url.startsWith('#')) {
      return '';
    }
    
    for (const protocol of SPECIAL_PROTOCOLS) {
      if (url.toLowerCase().startsWith(protocol)) {
        return '';
      }
    }
    
    // Si c'est une URL de données, retourner vide
    if (url.startsWith('data:')) {
      return '';
    }
    
    const urlObj = new URL(normalizeUrl(url));
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

/**
 * Extrait le protocole d'une URL
 * @param {string} url - URL pour extraire le protocole
 * @returns {string} - Protocole ou 'unknown' si non détecté
 */
export function extractProtocol(url) {
  // Fragment d'ancre uniquement
  if (url.startsWith('#')) {
    return 'fragment';
  }
  
  // Vérifier les protocoles spéciaux
  for (const protocol of SPECIAL_PROTOCOLS) {
    if (url.toLowerCase().startsWith(protocol)) {
      return protocol.slice(0, -1); // Enlever le : final
    }
  }
  
  // URL de données
  if (url.startsWith('data:')) {
    return 'data';
  }
  
  try {
    const urlObj = new URL(normalizeUrl(url));
    return urlObj.protocol.replace(':', '');
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Catégorise un code de statut HTTP
 * @param {number} statusCode - Code de statut HTTP
 * @returns {string} - Catégorie du code de statut
 */
export function categorizeStatusCode(statusCode) {
  if (statusCode >= 100 && statusCode < 200) return 'info';
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'redirect';
  if (statusCode >= 400 && statusCode < 500) return 'clientError';
  if (statusCode >= 500) return 'serverError';
  return 'unknown';
}

/**
 * Obtient une description pour un code de statut HTTP
 * @param {number} statusCode - Code de statut HTTP
 * @returns {string} - Description du code de statut
 */
export function getStatusCodeDescription(statusCode) {
  const descriptions = {
    // Informational 1xx
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',
    103: 'Early Hints',
    
    // Successful 2xx
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',
    208: 'Already Reported',
    226: 'IM Used',
    
    // Redirection 3xx
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    
    // Client Error 4xx
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: 'I\'m a teapot',
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    428: 'Precondition Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    451: 'Unavailable For Legal Reasons',
    
    // Server Error 5xx
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    510: 'Not Extended',
    511: 'Network Authentication Required'
  };
  
  return descriptions[statusCode] || 'Unknown Status Code';
}

/**
 * Vérifie si une URL est probablement une image basée sur l'URL ou l'extension
 * @param {string} url - URL à vérifier
 * @returns {boolean} - True si l'URL semble être une image
 */
export function isImageUrl(url) {
  if (!url) return false;
  
  // URLs de données
  if (url.startsWith('data:image/')) return true;
  
  // Extensions d'image communes
  const urlLower = url.toLowerCase();
  
  // Vérifier les extensions
  for (const ext of IMAGE_EXTENSIONS) {
    if (urlLower.endsWith(ext)) return true;
  }
  
  // Vérifier les motifs courants dans les chemins
  return urlLower.includes('/images/') ||
         urlLower.includes('/img/') ||
         urlLower.includes('/pics/') ||
         urlLower.includes('/photos/') ||
         urlLower.includes('/thumbnails/') ||
         urlLower.match(/\/\w+\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|tif|avif|heic)(\?|#|$)/i) !== null;
}

/**
 * Vérifie si un type MIME correspond à une image
 * @param {string} mimeType - Type MIME à vérifier
 * @returns {boolean} - True si le type MIME est une image
 */
export function isImageMimeType(mimeType) {
  if (!mimeType) return false;
  
  return IMAGE_MIME_TYPES.some(type => mimeType.toLowerCase().startsWith(type));
}

/**
 * Détermine le type de lien ou d'élément basé sur l'URL et les métadonnées
 * @param {Object} result - Résultat de la vérification
 * @returns {string} - Type de lien (mailto, tel, facebook, image, etc.)
 */
export function determineResourceType(result) {
  const url = result.url || '';
  
  // Vérifier les protocoles spéciaux
  if (url.startsWith('mailto:')) return 'mailto';
  if (url.startsWith('tel:')) return 'tel';
  if (url.startsWith('javascript:')) return 'javascript';
  if (url.startsWith('#')) return 'fragment';
  if (result.isSpecialProtocol) return result.protocol || 'special';
  if (result.isFragment) return 'fragment';
  
  // URL de données
  if (url.startsWith('data:')) {
    if (url.startsWith('data:image/')) return 'data-image';
    return 'data';
  }
  
  // Vérifier si c'est une image
  if (result.isImage || result.contentType && isImageMimeType(result.contentType) || isImageUrl(url)) {
    return 'image';
  }
  
  // Vérifier les domaines problématiques spécifiques
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('pinterest.com')) return 'pinterest';
  if (url.includes('.youtube.com')) return '.youtube';
  
  // Autres cas spéciaux
  if (result.isCorsBlocked) return 'cors';
  if (result.isProblematicDomain) return 'problematic';
  
  // Cas par défaut
  return 'standard';
}

/**
 * Génère un nom de fichier valide basé sur une date
 * @param {string} [prefix='link-check'] - Préfixe du nom de fichier
 * @param {string} [extension='json'] - Extension du fichier
 * @returns {string} - Nom de fichier formaté
 */
export function generateTimestampFilename(prefix = 'link-check', extension = 'json') {
  const date = new Date();
  const timestamp = date.toISOString()
    .replace(/:/g, '-')    // Remplacer les : par -
    .replace(/\..+/, '')   // Supprimer les millisecondes
    .replace('T', '_');    // Remplacer T par _
  
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Tronque une URL pour l'affichage
 * @param {string} url - URL à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - URL tronquée
 */
export function truncateUrl(url, maxLength = 50) {
  if (!url) return '';
  
  // Pour les URLs de données, montrer seulement le début
  if (url.startsWith('data:')) {
    const dataType = url.substring(0, url.indexOf(';') !== -1 ? url.indexOf(';') : url.indexOf(','));
    return `${dataType}... (URL de données)`;
  }
  
  if (url.length <= maxLength) return url;
  
  // Tronquer intelligemment
  const urlObj = tryParseUrl(url);
  if (urlObj) {
    // Privilégier l'affichage du domaine et du début du chemin
    const domain = urlObj.hostname;
    const path = urlObj.pathname + urlObj.search + urlObj.hash;
    
    if (domain.length + 3 >= maxLength) {
      // Si le domaine est déjà trop long
      return domain.substring(0, maxLength - 3) + '...';
    }
    
    const availableLength = maxLength - domain.length - 3; // -3 pour "://..."
    if (availableLength <= 5) {
      // Si trop peu d'espace pour le chemin
      return domain + '/...';
    }
    
    // Tronquer le chemin
    const pathStart = path.substring(0, Math.max(Math.floor(availableLength * 0.7), 5));
    return domain + '/...' + path.substring(path.length - Math.floor(availableLength * 0.3));
  }
  
  // Fallback: tronquer au milieu
  const start = url.substring(0, Math.floor(maxLength / 2) - 2);
  const end = url.substring(url.length - Math.floor(maxLength / 2) + 1);
  return `${start}...${end}`;
}

/**
 * Essaie de parser une URL, retourne null en cas d'échec
 * @param {string} url - URL à parser
 * @returns {URL|null} - Objet URL ou null si invalide
 */
export function tryParseUrl(url) {
  try {
    return new URL(normalizeUrl(url));
  } catch (e) {
    return null;
  }
}

/**
 * Formate une date en chaîne lisible
 * @param {string|Date} date - Date à formater
 * @returns {string} - Date formatée
 */
export function formatDate(date) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Convertit une taille en octets en taille lisible par un humain
 * @param {number} bytes - Taille en octets
 * @param {number} [decimals=2] - Nombre de décimales à afficher
 * @returns {string} - Taille formatée (ex: "1.23 KB")
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Génère un sélecteur CSS pour un élément du DOM
 * @param {Element} element - Élément DOM
 * @returns {string} - Sélecteur CSS
 */
export function generateSelector(element) {
  if (!element) return '';
  
  // Utiliser l'ID si disponible
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  
  // Essayer d'utiliser des classes uniques
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter(c => c);
    if (classes.length) {
      // Vérifier si une des classes est unique
      for (const className of classes) {
        if (document.getElementsByClassName(className).length === 1) {
          return `.${CSS.escape(className)}`;
        }
      }
      
      // Sinon utiliser toutes les classes
      const selector = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }
  
  // Construire un sélecteur basé sur les parents
  const path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    let tag = current.tagName.toLowerCase();
    
    // Ajouter un indice s'il y a plusieurs éléments du même type
    if (current.parentNode) {
      const siblings = Array.from(current.parentNode.children).filter(
        child => child.tagName === current.tagName
      );
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        tag += `:nth-child(${index})`;
      }
    }
    
    path.unshift(tag);
    
    // Limiter la profondeur pour éviter des sélecteurs trop longs
    if (path.length >= 3) break;
    
    current = current.parentNode;
  }
  
  return path.join(' > ');
}

/**
 * Échappe les caractères HTML pour un affichage sécurisé
 * @param {string} text - Texte à échapper
 * @returns {string} - Texte échappé
 */
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

/**
 * Détecte si l'URL utilise des paramètres de suivi communs
 * @param {string} url - URL à analyser
 * @returns {boolean} - True si des paramètres de suivi sont détectés
 */
export function hasTrackingParams(url) {
  try {
    const urlObj = new URL(normalizeUrl(url));
    
    // Liste des paramètres de suivi communs
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'dclid', 'zanpid', 'igshid',
      '_ga', '_gl', '_hsenc', '_hsmi', 'ref', 'referrer', 'source',
      'track', 'tracking', 'campaign', 'affid', 'affiliate',
      'cmp', 'mc_cid', 'mc_eid'
    ];
    
    // Vérifier si un des paramètres est présent
    for (const param of trackingParams) {
      if (urlObj.searchParams.has(param)) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Nettoie une URL en supprimant les paramètres de suivi
 * @param {string} url - URL à nettoyer
 * @returns {string} - URL nettoyée
 */
export function cleanTrackingParams(url) {
  try {
    const urlObj = new URL(normalizeUrl(url));
    
    // Liste des paramètres de suivi communs
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'dclid', 'zanpid', 'igshid',
      '_ga', '_gl', '_hsenc', '_hsmi', 'ref', 'referrer', 'source',
      'track', 'tracking', 'campaign', 'affid', 'affiliate',
      'cmp', 'mc_cid', 'mc_eid'
    ];
    
    // Supprimer les paramètres de suivi
    for (const param of trackingParams) {
      urlObj.searchParams.delete(param);
    }
    
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}