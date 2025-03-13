/**
 * Module de vérification des images pour l'extension Chrome
 * Version avec gestion avancée des problèmes CORS
 */

import { 
    normalizeUrl, 
    categorizeStatusCode, 
    isProblematicDomain 
  } from './utils.js';
  
  // Liste des types MIME d'images courants
  const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/x-icon'
  ];
  
  /**
   * Options par défaut pour la vérification des images
   */
  export const DEFAULT_IMAGE_OPTIONS = {
    concurrency: 3,           // Moins que pour les liens car les images sont généralement plus volumineuses
    timeout: 15000,           // Timeout plus long pour les images
    maxImageSize: 5 * 1024 * 1024, // Taille maximale d'image (5 Mo)
    allowDataUrls: true,      // Autoriser les URLs de données
    checkImageDimensions: false, // Vérifier les dimensions de l'image
    retryCount: 1,            // Nombre de tentatives en cas d'échec
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    useFetchMode: 'cors',     // Mode fetch: 'cors', 'no-cors', ou 'fallback'
    useBlobFallback: true     // Utiliser un fallback via création d'objet Image pour contourner CORS
  };
  
  /**
   * Vérifie une image unique
   * @param {string} url - URL de l'image à vérifier
   * @param {Object} [options={}] - Options de configuration
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  export async function checkImage(url, options = {}) {
    const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };
    
    // Gestion des URLs de données (data:image/...)
    if (url.startsWith('data:')) {
      if (!opts.allowDataUrls) {
        return {
          url: url.substring(0, 40) + '...', // Tronquer pour éviter les URL trop longues
          status: 'skipped',
          statusMessage: 'Les URLs de données ne sont pas autorisées',
          timestamp: new Date().toISOString()
        };
      }
      
      return processDataUrl(url);
    }
    
    // Normalisation et validation d'URL
    let normalizedUrl;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch (error) {
      return {
        url: url,
        status: 'invalid',
        statusMessage: error.message,
        timestamp: new Date().toISOString()
      };
    }
    
    // Déterminer si le domaine est connu pour être problématique
    const isProblematic = isProblematicDomain(url);
    let retryCount = isProblematic ? opts.retryCount : 0;
    let lastError = null;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Petite pause entre les tentatives
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Essayer d'abord avec le mode fetch précisé (cors par défaut)
        const result = await performImageRequestWithFetch(normalizedUrl, opts, opts.useFetchMode);
        
        // Si le résultat indique un problème CORS et que le fallback est activé
        if (result.isCorsBlocked && opts.useBlobFallback) {
          // Essayer la méthode alternative en créant un élément Image
          try {
            const blobResult = await performImageRequestWithBlobImage(normalizedUrl, opts);
            // Si la méthode alternative réussit, on renvoie son résultat
            if (blobResult.status === 'success') {
              return {
                ...blobResult,
                corsWorkaround: true,
                originalError: result.statusMessage
              };
            }
          } catch (blobError) {
            // Si la méthode alternative échoue aussi, on continue avec le résultat original
          }
        }
        
        // Si c'est un domaine problématique connu, marquer comme tel
        if (isProblematic) {
          result.isProblematicDomain = true;
        }
        
        return result;
      } catch (error) {
        lastError = error;
        // Continuer la boucle pour réessayer si ce n'est pas la dernière tentative
      }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    
    // Gérer les erreurs spécifiques
    let status = 'error';
    let statusMessage = lastError.message;
    let isCorsBlocked = lastError.name === 'TypeError' && 
                       (lastError.message.includes('CORS') || 
                        lastError.message.includes('cross-origin') || 
                        lastError.message.includes('Access-Control-Allow-Origin'));
    
    if (lastError.name === 'AbortError') {
      status = 'error';
      statusMessage = 'Délai d\'attente dépassé';
    } else if (isCorsBlocked) {
      status = 'warning';
      statusMessage = 'Blocage CORS - Accès refusé par la politique cross-origin';
    } else if (lastError.name === 'TypeError' && !isCorsBlocked) {
      status = 'invalid';
      statusMessage = 'URL invalide ou problème réseau';
    }
    
    // Gestion spéciale pour les domaines problématiques
    if (isProblematic && !isCorsBlocked) {
      status = 'warning';
      statusMessage = `Site potentiellement protégé: ${statusMessage}`;
    }
    
    return {
      url,
      normalizedUrl: normalizedUrl || url,
      status,
      statusMessage,
      isCorsBlocked,
      isProblematicDomain: isProblematic,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Effectue une requête d'image avec fetch API
   * @param {string} url - URL de l'image
   * @param {Object} options - Options de configuration
   * @param {string} mode - Mode fetch ('cors', 'no-cors')
   * @returns {Promise<Object>} - Résultat de la requête
   */
  async function performImageRequestWithFetch(url, options, mode = 'cors') {
    // Créer un controller pour le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);
    
    try {
      // Faire la requête avec des en-têtes plus complets
      const headers = {
        'User-Agent': options.userAgent,
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // Mode CORS ou no-CORS selon l'option
      const fetchMode = mode === 'no-cors' ? 'no-cors' : 'cors';
      
      const response = await fetch(url, {
        method: 'GET', // Utiliser GET pour les images
        redirect: 'follow',
        signal: controller.signal,
        credentials: 'omit',
        mode: fetchMode,
        headers: headers
      });
      
      // Annuler le timeout
      clearTimeout(timeoutId);
      
      // Si mode no-cors, on ne peut pas accéder aux détails de la réponse
      if (mode === 'no-cors') {
        // On peut seulement savoir si la requête a réussi
        return {
          url,
          finalUrl: url, // On ne peut pas savoir l'URL finale en mode no-cors
          status: 'success',
          statusMessage: 'Image accessible (vérification limitée mode no-cors)',
          isImage: true, // On suppose que c'est une image
          noAccessToHeaders: true,
          timestamp: new Date().toISOString()
        };
      }
      
      // Vérifier le type MIME
      const contentType = response.headers.get('content-type') || '';
      const isImage = IMAGE_MIME_TYPES.some(type => contentType.includes(type));
      
      // Vérifier la taille
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const isSizeExceeded = contentLength > 0 && contentLength > options.maxImageSize;
      
      // Traiter la réponse
      const result = {
        url,
        finalUrl: response.url,
        statusCode: response.status,
        statusMessage: response.statusText,
        status: isImage ? categorizeStatusCode(response.status) : 'invalid',
        contentType,
        contentLength,
        isImage,
        timestamp: new Date().toISOString()
      };
      
      if (!isImage && result.status === 'success') {
        result.status = 'invalid';
        result.statusMessage = 'Le contenu n\'est pas une image';
      }
      
      if (isSizeExceeded) {
        result.status = 'error';
        result.statusMessage = `Taille de l'image (${contentLength}) dépasse la limite (${options.maxImageSize})`;
      }
      
      // Si on veut vérifier les dimensions de l'image
      if (options.checkImageDimensions && isImage && !isSizeExceeded) {
        try {
          // Obtenir le blob
          const blob = await response.blob();
          
          // Créer une URL temporaire pour le blob
          const blobUrl = URL.createObjectURL(blob);
          
          // Charger l'image depuis le blob pour obtenir les dimensions
          const dimensions = await getImageDimensions(blobUrl);
          
          // Nettoyer l'URL
          URL.revokeObjectURL(blobUrl);
          
          // Ajouter les dimensions au résultat
          result.imageDimensions = dimensions;
        } catch (error) {
          // Si on ne peut pas obtenir les dimensions, ce n'est pas grave
          result.statusMessage += ' (Dimensions non disponibles)';
        }
      }
      
      return result;
    } catch (error) {
      // Annuler le timeout si ce n'est pas déjà fait
      clearTimeout(timeoutId);
      
      // Vérifier si c'est une erreur CORS
      const isCorsError = error.name === 'TypeError' && 
                         (error.message.includes('CORS') || 
                          error.message.includes('cross-origin') || 
                          error.message.includes('Access-Control-Allow-Origin'));
      
      if (isCorsError && mode === 'cors' && options.useFetchMode === 'fallback') {
        // Essayer à nouveau avec le mode no-cors
        return performImageRequestWithFetch(url, options, 'no-cors');
      }
      
      throw {
        ...error,
        isCorsBlocked: isCorsError
      };
    }
  }
  
  /**
   * Alternative pour vérifier une image en utilisant un élément Image
   * Cette méthode peut contourner certains problèmes CORS
   * @param {string} url - URL de l'image
   * @param {Object} options - Options de configuration
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  function performImageRequestWithBlobImage(url, options) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timeoutId = null;
      
      const handleSuccess = () => {
        if (timeoutId) clearTimeout(timeoutId);
        
        resolve({
          url,
          finalUrl: url, // Pas d'accès à l'URL finale
          status: 'success',
          statusMessage: 'Image chargée avec succès',
          isImage: true,
          imageDimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight
          },
          blobMethod: true,
          timestamp: new Date().toISOString()
        });
      };
      
      const handleError = () => {
        if (timeoutId) clearTimeout(timeoutId);
        
        reject({
          name: 'ImageLoadError',
          message: 'Impossible de charger l\'image',
          isCorsBlocked: false
        });
      };
      
      // Définir un timeout
      timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        
        reject({
          name: 'AbortError',
          message: 'Délai d\'attente dépassé'
        });
      }, options.timeout);
      
      // Configurer les gestionnaires d'événements
      img.onload = handleSuccess;
      img.onerror = handleError;
      
      // Définir la source (déclenche le chargement)
      img.src = url;
      
      // Pour certains navigateurs, si l'image est déjà en cache, 
      // onload peut être appelé avant que ces gestionnaires soient définis
      if (img.complete) {
        handleSuccess();
      }
    });
  }
  
  /**
   * Obtenir les dimensions d'une image
   * @param {string} url - URL de l'image (peut être une URL de blob)
   * @returns {Promise<Object>} - Dimensions de l'image {width, height}
   */
  function getImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = () => {
        reject(new Error('Impossible de charger l\'image pour obtenir les dimensions'));
      };
      
      img.src = url;
    });
  }
  
  /**
   * Traite les URLs de données d'image
   * @param {string} dataUrl - URL de données à traiter
   * @returns {Object} - Résultat du traitement
   */
  function processDataUrl(dataUrl) {
    try {
      // Vérifier le format de l'URL de données
      const matches = dataUrl.match(/^data:([^;]+);([^,]+),(.*)$/);
      if (!matches) {
        return {
          url: dataUrl.substring(0, 40) + '...',
          status: 'invalid',
          statusMessage: 'Format d\'URL de données invalide',
          timestamp: new Date().toISOString()
        };
      }
      
      const mimeType = matches[1];
      const encoding = matches[2];
      const isImage = mimeType.startsWith('image/');
      
      // Estimer la taille (pour base64)
      let sizeInBytes = 0;
      if (encoding === 'base64') {
        const data = matches[3];
        sizeInBytes = Math.ceil((data.length * 3) / 4);
      }
      
      // Pour les data URLs d'images, on peut créer un élément Image
      // pour obtenir les dimensions
      if (isImage) {
        // Créer une image pour obtenir les dimensions
        return new Promise((resolve) => {
          const img = new Image();
          
          img.onload = () => {
            resolve({
              url: dataUrl.substring(0, 40) + '...',
              status: 'success',
              statusMessage: 'URL de données d\'image valide',
              contentType: mimeType,
              contentLength: sizeInBytes,
              isImage: true,
              isDataUrl: true,
              imageDimensions: {
                width: img.naturalWidth,
                height: img.naturalHeight
              },
              timestamp: new Date().toISOString()
            });
          };
          
          img.onerror = () => {
            resolve({
              url: dataUrl.substring(0, 40) + '...',
              status: 'invalid',
              statusMessage: 'Données d\'image invalides',
              contentType: mimeType,
              isDataUrl: true,
              timestamp: new Date().toISOString()
            });
          };
          
          img.src = dataUrl;
        });
      }
      
      return {
        url: dataUrl.substring(0, 40) + '...',
        status: isImage ? 'success' : 'invalid',
        statusMessage: isImage ? 'URL de données d\'image valide' : 'Le contenu n\'est pas une image',
        contentType: mimeType,
        contentLength: sizeInBytes,
        isImage,
        isDataUrl: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        url: dataUrl.substring(0, 40) + '...',
        status: 'error',
        statusMessage: `Erreur lors du traitement de l'URL de données: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Vérifie plusieurs images avec contrôle de concurrence
   * @param {string[]} urls - Tableau d'URLs d'images à vérifier
   * @param {Object} [options={}] - Options de configuration
   * @param {Function} [progressCallback] - Callback optionnel pour les mises à jour de progression
   * @returns {Promise<Object[]>} - Résultats de toutes les vérifications
   */
  export async function checkImages(urls, options = {}, progressCallback = null) {
    const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };
    const results = [];
    const pendingPromises = new Set();
    
    // Filtrer et normaliser les URLs
    const validUrls = (urls || [])
      .filter(url => typeof url === 'string' && url.trim().length > 0)
      .map(url => url.trim());
    
    let processed = 0;
    const total = validUrls.length;
    
    if (total === 0) return [];
    
    // Répartir pour équilibrer la charge
    const dataUrls = validUrls.filter(url => url.startsWith('data:'));
    const problematicUrls = validUrls.filter(url => !url.startsWith('data:') && isProblematicDomain(url));
    const normalUrls = validUrls.filter(url => !url.startsWith('data:') && !isProblematicDomain(url));
    
    // Mélanger pour éviter de surcharger un même domaine
    const sortedUrls = [
      ...dataUrls,        // Les data URLs en premier (rapides et sans requête réseau)
      ...normalUrls,      // Les URLs normales ensuite
      ...problematicUrls  // Les domaines problématiques à la fin
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
          
          const promise = checkImage(url, opts).then(result => {
            results.push(result);
            pendingPromises.delete(promise);
            
            // Signaler la progression si callback fourni
            if (progressCallback && typeof progressCallback === 'function') {
              progressCallback({
                processed: results.length,
                total,
                result,
                pending: pendingPromises.size
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