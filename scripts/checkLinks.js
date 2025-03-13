/**
 * Module de vérification des liens pour l'extension Chrome
 *
 * Version adaptée pour les extensions Chrome - utilise fetch() au lieu de http/https
 */

import {
  normalizeUrl,
  categorizeStatusCode,
  extractDomain,
  isCheckableUrl,
  extractProtocol,
  isProblematicDomain,
  SPECIAL_PROTOCOLS,
} from "./utils.js";

/**
 * Options par défaut pour la vérification des liens
 */
export const DEFAULT_LINK_OPTIONS = {
  concurrency: 5,
  timeout: 10000,
  maxRedirects: 5,
  checkAnchors: false,
  checkExternal: true,
  followRedirects: true,
  includeSpecialProtocols: true,
  retryCount: 1, // Tentatives supplémentaires pour les liens problématiques
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", // User-Agent plus réaliste
  treatFragmentsAsValid: true, // Traiter les fragments d'ancre seuls comme valides
};

/**
 * Vérifie si une URL appartient à un service utilisant des chemins complexes
 * qui pourraient être confondus avec des ancres
 * @param {string} url - URL à vérifier
 * @returns {boolean} - True si c'est un service spécial
 */
function isMappyOrSimilarURL(url) {
  const specialDomains = [
    'mappy.com',
    'fr.mappy.com',
    'google.com/maps',
    'maps.google.com',
    'waze.com',
    'openstreetmap.org',
    'bing.com/maps',
    'yandex.com/maps',
    'mapquest.com'
  ];
  
  try {
    const urlObj = new URL(url);
    return specialDomains.some(domain => 
      urlObj.hostname === domain || 
      urlObj.hostname.endsWith('.' + domain) ||
      urlObj.hostname.includes(domain)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Vérifie un lien unique
 * @param {string} url - URL à vérifier
 * @param {Object} [options={}] - Options de configuration
 * @returns {Promise<Object>} - Résultat de la vérification
 */
export async function checkLink(url, options = {}) {
  const opts = { ...DEFAULT_LINK_OPTIONS, ...options };

  if (url.includes('mappy.com') && result.status === 'success') {
    // URL Mappy valide, ne pas vérifier l'ancre quelle que soit l'option
    return {
      ...result,
      // Ajouter une information mais ne pas changer le statut
      statusMessage: result.statusMessage || "Service cartographique validé (URL complexe)",
      isMappyURL: true
    };
  }

  console.log("URL à vérifier:", url);
  console.log("Est Mappy?", isMappyOrSimilarURL(url));
  console.log("Hash détecté:", new URL(url).hash);

  // Gestion des fragments d'ancre uniquement
  if (url.startsWith("#")) {
    if (opts.treatFragmentsAsValid) {
      return {
        url: url,
        status: "success",
        statusMessage: "Fragment d'ancre sur la page courante",
        protocol: "fragment",
        isFragment: true,
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        url: url,
        status: "skipped",
        statusMessage: "Fragment d'ancre uniquement - non vérifié",
        protocol: "fragment",
        isFragment: true,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Gestion des protocoles spéciaux
  if (
    SPECIAL_PROTOCOLS.some((protocol) => url.toLowerCase().startsWith(protocol))
  ) {
    if (!opts.includeSpecialProtocols) {
      return {
        url: url,
        status: "skipped",
        statusMessage: "Protocole spécial non vérifié",
        protocol: extractProtocol(url),
        isSpecialProtocol: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Cas spécial pour javascript:
    if (url.toLowerCase().startsWith("javascript:")) {
      return {
        url: url,
        status: "success",
        statusMessage: "Lien JavaScript",
        protocol: "javascript",
        isSpecialProtocol: true,
        isJavaScript: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Marquer les protocoles spéciaux comme valides mais non vérifiables
    return {
      url: url,
      status: "success",
      statusMessage: `Lien avec protocole "${extractProtocol(url)}" valide`,
      protocol: extractProtocol(url),
      isSpecialProtocol: true,
      timestamp: new Date().toISOString(),
    };
  }

  // Normalisation et validation d'URL
  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch (error) {
    return {
      url: url,
      status: "invalid",
      statusMessage: error.message,
      timestamp: new Date().toISOString(),
    };
  }

  // Vérifier si l'URL est vérifiable via HTTP/HTTPS
  if (!isCheckableUrl(url)) {
    return {
      url: url,
      status: "invalid",
      statusMessage: "URL non vérifiable via HTTP/HTTPS",
      timestamp: new Date().toISOString(),
    };
  }

  // Vérifier si le domaine est connu pour être problématique
  const isProblematic = isProblematicDomain(url);
  let retryCount = isProblematic ? opts.retryCount : 0;
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // Petite pause entre les tentatives
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Créer un controller pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      // Faire la requête avec des en-têtes plus complets pour les sites problématiques
      const headers = {
        "User-Agent": opts.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };

      const response = await fetch(normalizedUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        credentials: "omit",
        headers: headers,
      }).catch(async (error) => {
        // Si HEAD échoue, essayer GET
        if (error.name === "TypeError") {
          return fetch(normalizedUrl, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            credentials: "omit",
            headers: headers,
          });
        }
        throw error;
      });

      // Annuler le timeout
      clearTimeout(timeoutId);

      // Traiter la réponse
      const result = {
        url,
        normalizedUrl,
        finalUrl: response.url,
        statusCode: response.status,
        statusMessage: response.statusText,
        status: categorizeStatusCode(response.status),
        contentType: response.headers.get("content-type"),
        timestamp: new Date().toISOString(),
      };

      // Si c'est un domaine problématique connu, marquer comme tel
      if (isProblematic) {
        result.isProblematicDomain = true;
        // Si le statut est une erreur client pour un domaine problématique,
        // on peut le traiter comme un avertissement car ça peut être une protection anti-scraping
        if (
          result.status === "clientError" &&
          [403, 429, 418].includes(result.statusCode)
        ) {
          result.status = "warning";
          result.statusMessage = `Erreur ${result.statusCode} - Possible protection anti-scraping`;
        }
      }

      // Vérifier l'ancre si nécessaire
      if (
        opts.checkAnchors &&
        new URL(url).hash &&
        result.status === "success"
      ) {
        // Détecter si c'est une URL de service cartographique
        const isMappyOrSimilar = isMappyOrSimilarURL(url);

        if (!isMappyOrSimilar) {
          const anchorResult = await checkAnchor(url, result, opts);
          Object.assign(result, anchorResult);

          if (anchorResult.anchorChecked && !anchorResult.anchorValid) {
            // Changer en avertissement plutôt qu'en erreur
            result.status = "warning";
            result.statusMessage = `Ancre "${anchorResult.anchorName}" non trouvée`;
          }
        }
      }

      return result;
    } catch (error) {
      lastError = error;
      // Continuer la boucle pour réessayer si ce n'est pas la dernière tentative
    }
  }

  // Si on arrive ici, toutes les tentatives ont échoué

  // Gérer les erreurs spécifiques
  let status = "error";
  let statusMessage = lastError.message;

  if (lastError.name === "AbortError") {
    status = "error";
    statusMessage = "Délai d'attente dépassé";
  } else if (lastError.name === "TypeError") {
    status = "invalid";
    statusMessage = "URL invalide ou problème réseau. Status : "+result.status;
  }

  // Gestion spéciale pour les domaines problématiques
  if (isProblematic) {
    status = "warning";
    statusMessage = `Site potentiellement protégé: ${statusMessage}`;
  }

  // Vérification spéciale pour Facebook
  if (url.includes("facebook.com") && status === "invalid") {
    status = "warning";
    statusMessage =
      "Les liens Facebook peuvent être valides même s'ils ne sont pas vérifiables";
  }

  return {
    url,
    normalizedUrl: normalizedUrl || url,
    status,
    statusMessage,
    isProblematicDomain: isProblematic,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Vérifie si une ancre existe dans une page
 * @param {string} url - URL avec ancre
 * @param {Object} linkResult - Résultat de la vérification du lien
 * @param {Object} options - Options de vérification
 * @returns {Promise<Object>} - Informations sur l'ancre
 */
async function checkAnchor(url, linkResult, options) {
  try {
    const urlObj = new URL(url);
    const anchor = urlObj.hash.substring(1); // Enlever le # initial

    if (!anchor) {
      return { anchorChecked: false };
    }

    // Faire une requête GET pour obtenir le HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || 10000
    );

    const response = await fetch(linkResult.finalUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      credentials: "omit",
      headers: {
        "User-Agent": options.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        anchorChecked: true,
        anchorValid: false,
        anchorName: anchor,
        anchorError: `Impossible de récupérer le contenu (${response.status})`,
      };
    }

    const html = await response.text();

    // Recherche plus complète dans le HTML
    // 1. Recherche d'ID
    const hasId = new RegExp(`id=["']${anchor}["']`, "i").test(html);

    // 2. Recherche de balise d'ancre
    const hasAnchorTag = new RegExp(
      `<a[^>]+name=["']${anchor}["'][^>]*>`,
      "i"
    ).test(html);

    // 3. Recherche d'attribut name sur d'autres éléments
    const hasNameAttr = new RegExp(`name=["']${anchor}["']`, "i").test(html);

    // 4. Recherche de liens internes qui correspondent à l'ancre
    const hasInternalLink = new RegExp(`href=["']#${anchor}["']`, "i").test(
      html
    );

    return {
      anchorChecked: true,
      anchorValid: hasId || hasAnchorTag || hasNameAttr || hasInternalLink,
      anchorName: anchor,
      anchorDetails: {
        hasId,
        hasAnchorTag,
        hasNameAttr,
        hasInternalLink,
      },
    };
  } catch (error) {
    return {
      anchorChecked: true,
      anchorValid: false,
      anchorName: url.split("#")[1] || "",
      anchorError: error.message,
    };
  }
}

/**
 * Vérifie plusieurs liens avec contrôle de concurrence
 * @param {string[]} urls - Tableau d'URLs à vérifier
 * @param {Object} [options={}] - Options de configuration
 * @param {Function} [progressCallback] - Callback optionnel pour les mises à jour de progression
 * @returns {Promise<Object[]>} - Résultats de toutes les vérifications
 */
export async function checkLinks(urls, options = {}, progressCallback = null) {
  const opts = { ...DEFAULT_LINK_OPTIONS, ...options };
  const results = [];
  const pendingPromises = new Set();

  // Filtrer et normaliser les URLs
  const validUrls = (urls || [])
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.trim());

  let processed = 0;
  const total = validUrls.length;

  if (total === 0) return [];

  // Répartir les domaines problématiques et normaux pour équilibrer la charge
  const problematicUrls = validUrls.filter((url) => isProblematicDomain(url));
  const normalUrls = validUrls.filter((url) => !isProblematicDomain(url));

  // Mélanger pour éviter de surcharger un même domaine
  const sortedUrls = [
    ...normalUrls,
    ...problematicUrls, // Les domaines problématiques à la fin pour donner priorité aux normaux
  ];

  return new Promise((resolve) => {
    const processNext = () => {
      // Vérifier si terminé
      if (processed >= total && pendingPromises.size === 0) {
        return resolve(results);
      }

      // Traiter plus d'URLs si sous la limite de concurrence
      while (pendingPromises.size < opts.concurrency && processed < total) {
        const url = sortedUrls[processed++];

        const promise = checkLink(url, opts).then((result) => {
          results.push(result);
          pendingPromises.delete(promise);

          // Signaler la progression si callback fourni
          if (progressCallback && typeof progressCallback === "function") {
            progressCallback({
              processed: results.length,
              total,
              result,
              pending: pendingPromises.size,
            });
          }

          // Traiter le prochain lot
          processNext();
        });

        pendingPromises.add(promise);
      }
    };

    // Démarrer le traitement
    processNext();
  });
}
