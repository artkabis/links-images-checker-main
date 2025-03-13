/**
 * Script d'arrière-plan pour l'extension Link & Image Checker
 * Gère la vérification des liens et des images en arrière-plan
 */

// Importation des modules
import { 
    categorizeStatusCode, 
    isImageUrl, 
    isValidUrl, 
    normalizeUrl, 
    isCheckableUrl, 
    extractProtocol,
    isProblematicDomain, 
    SPECIAL_PROTOCOLS 
  } from '../scripts/utils.js';
  
  // Variables globales
  let checkActive = false;
  let checkAborted = false;
  let scanTimestamp = null;
  let currentResults = {
    links: [],
    images: []
  };
  
  // Écouteurs de messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startCheck') {
      startCheckProcess(message.tabId, message.options, message.timestamp);
      return true;
    } else if (message.action === 'stopCheck') {
      checkAborted = true;
      return true;
    }
  });
  
  /**
   * Commence le processus de vérification
   * @param {number} tabId - ID de l'onglet à vérifier
   * @param {Object} options - Options de vérification
   * @param {string} timestamp - Timestamp de l'analyse
   */
  async function startCheckProcess(tabId, options, timestamp) {
    // Réinitialiser les variables
    checkActive = true;
    checkAborted = false;
    scanTimestamp = timestamp || new Date().toISOString();
    currentResults = {
      links: [],
      images: []
    };
    
    try {
      // Collecter les URLs depuis la page
      const urls = await collectUrlsFromPage(tabId);
      
      // Filtrer selon les options
      const linksToCheck = options.checkExternal ? 
        urls.links : 
        urls.links.filter(url => isSameDomain(url, urls.pageUrl));
      
      const imagesToCheck = options.checkImages ? 
        urls.images : 
        [];
      
      // Envoyer la mise à jour de progression initiale
      sendProgressUpdate({
        processed: 0, 
        total: linksToCheck.length + imagesToCheck.length
      });
      
      // Vérifier les liens et les images
      await Promise.all([
        checkLinks(linksToCheck, tabId, options),
        checkImages(imagesToCheck, tabId, options)
      ]);
      
      // Envoi des résultats finaux
      sendCheckComplete();
      
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      sendCheckComplete({
        error: error.message
      });
    } finally {
      checkActive = false;
      checkAborted = false;
    }
  }
  
  /**
   * Collecte toutes les URLs de liens et d'images depuis la page
   * @param {number} tabId - ID de l'onglet à analyser
   * @returns {Promise<Object>} - Les URLs collectées
   */
  async function collectUrlsFromPage(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          const pageUrl = window.location.href;
          const links = [];
          const images = [];
          
          // Collecter tous les liens avec une gestion améliorée
          document.querySelectorAll('a[href]').forEach(a => {
            try {
              const href = a.href;
              if (href && !links.includes(href)) {
                // Inclure même les mailto:, tel:, javascript: et #fragments
                links.push(href);
              }
            } catch (e) {
              // Ignorer les erreurs d'URL invalides
            }
          });
          
          // Collecter toutes les images
          document.querySelectorAll('img[src]').forEach(img => {
            try {
              const src = img.src;
              if (src && !images.includes(src)) {
                images.push(src);
              }
            } catch (e) {
              // Ignorer les erreurs d'URL invalides
            }
          });
          
          // Collecter les images d'arrière-plan
          const findBackgroundImages = (elements) => {
            elements.forEach(el => {
              try {
                const style = window.getComputedStyle(el);
                let bgImage = style.backgroundImage;
                
                if (bgImage && bgImage !== 'none') {
                  // Extraire l'URL de la forme url("...")
                  const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/i);
                  if (match && match[1] && !images.includes(match[1])) {
                    images.push(match[1]);
                  }
                }
              } catch (e) {
                // Ignorer les erreurs
              }
            });
          };
          
          // Vérifier les éléments avec potentiellement des images d'arrière-plan
          findBackgroundImages(document.querySelectorAll('div, section, header, footer, aside, main'));
          
          return { links, images, pageUrl };
        }
      }).then(results => {
        if (results && results[0] && results[0].result) {
          resolve(results[0].result);
        } else {
          reject(new Error('Impossible de collecter les URLs depuis la page'));
        }
      }).catch(reject);
    });
  }
  
  /**
   * Vérifie si une URL est du même domaine que l'URL de la page
   * @param {string} url - URL à vérifier
   * @param {string} pageUrl - URL de la page
   * @returns {boolean} - True si même domaine
   */
  function isSameDomain(url, pageUrl) {
    try {
      const urlObj = new URL(url);
      const pageUrlObj = new URL(pageUrl);
      return urlObj.hostname === pageUrlObj.hostname;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Vérifie une liste de liens
   * @param {string[]} links - Liste des liens à vérifier
   * @param {number} tabId - ID de l'onglet
   * @param {Object} options - Options de vérification
   */
  async function checkLinks(links, tabId, options) {
    // Si aucun lien ou vérification arrêtée, terminer
    if (links.length === 0 || checkAborted) return;
    
    // Limiter la concurrence
    const concurrency = options.concurrency || 5;
    const queue = [...links];
    const activePromises = new Set();
    let processed = 0;
    
    while (queue.length > 0 && !checkAborted) {
      // Traiter jusqu'à concurrency liens à la fois
      while (activePromises.size < concurrency && queue.length > 0 && !checkAborted) {
        const url = queue.shift();
        
        const promise = checkLink(url, options)
          .then(result => {
            processed++;
            activePromises.delete(promise);
            
            // Ajouter le résultat
            currentResults.links.push(result);
            
            // Envoyer le résultat et la mise à jour de progression
            sendAddResult('link', result);
            sendProgressUpdate({
              processed,
              total: links.length,
              type: 'liens'
            });
            
            return result;
          })
          .catch(error => {
            processed++;
            activePromises.delete(promise);
            
            // Créer un résultat d'erreur
            const errorResult = {
              url,
              status: 'error',
              statusMessage: error.message,
              timestamp: new Date().toISOString()
            };
            
            // Ajouter le résultat
            currentResults.links.push(errorResult);
            
            // Envoyer le résultat et la mise à jour de progression
            sendAddResult('link', errorResult);
            sendProgressUpdate({
              processed,
              total: links.length,
              type: 'liens'
            });
          });
        
        activePromises.add(promise);
      }
      
      // Attendre qu'au moins une promesse se termine
      if (activePromises.size > 0 && !checkAborted) {
        await Promise.race(Array.from(activePromises));
      }
    }
    
    // Attendre que toutes les promesses actives se terminent
    if (activePromises.size > 0 && !checkAborted) {
      await Promise.all(Array.from(activePromises));
    }
  }
  
  /**
   * Vérifie un lien unique
   * @param {string} url - URL à vérifier
   * @param {Object} options - Options de vérification
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  async function checkLink(url, options) {
    const timeout = options.timeout || 10000;
    
    // Gestion des fragments d'ancre uniquement
    if (url.startsWith('#')) {
      return {
        url: url,
        status: 'success',
        statusMessage: 'Fragment d\'ancre sur la page courante',
        protocol: 'fragment',
        isFragment: true,
        timestamp: new Date().toISOString()
      };
    }
    
    // Gestion des protocoles spéciaux
    for (const protocol of SPECIAL_PROTOCOLS) {
      if (url.toLowerCase().startsWith(protocol)) {
        return {
          url: url,
          status: 'success',
          statusMessage: `Lien avec protocole "${protocol.slice(0, -1)}" valide`,
          protocol: protocol.slice(0, -1),
          isSpecialProtocol: true,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Vérifier si le domaine est connu pour être problématique
    const isProblematic = isProblematicDomain(url);
    
    try {
      // Créer un controller pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Faire la requête avec des en-têtes plus complets pour les sites problématiques
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // Faire la requête
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        credentials: 'omit',
        mode: 'no-cors',
        headers: headers
      }).catch(async (error) => {
        // Si HEAD échoue, essayer GET
        if (error.name === 'TypeError') {
          return fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            credentials: 'omit',
            mode: 'no-cors',
            headers: headers
          });
        }
        throw error;
      });
      
      // Annuler le timeout
      clearTimeout(timeoutId);
      
      // Traiter la réponse
      const result = {
        url,
        finalUrl: response.url,
        statusCode: response.status,
        statusMessage: response.statusText,
        status: categorizeStatusCode(response.status),
        contentType: response.headers.get('content-type'),
        timestamp: new Date().toISOString()
      };
      
      // Si c'est un domaine problématique connu, marquer comme tel
      if (isProblematic) {
        result.isProblematicDomain = true;
        // Si le statut est une erreur client pour un domaine problématique,
        // on peut le traiter comme un avertissement car ça peut être une protection anti-scraping
        if (result.status === 'clientError' && [403, 429, 418].includes(result.statusCode)) {
          result.status = 'warning';
          result.statusMessage = `Erreur ${result.statusCode} - Possible protection anti-scraping`;
        }
      }
      
      // Vérifier l'ancre si nécessaire
      if (options.checkAnchors && url.includes('#') && result.status === 'success') {
        const anchorResult = await checkAnchor(url, result, options);
        Object.assign(result, anchorResult);
        
        if (anchorResult.anchorChecked && !anchorResult.anchorValid) {
          result.status = 'clientError';
          result.statusMessage = `Ancre "${anchorResult.anchorName}" non trouvée`;
        }
      }
      
      return result;
      
    } catch (error) {
      // Gérer les erreurs spécifiques
      let status = 'error';
      let statusMessage = error.message;
      
      if (error.name === 'AbortError') {
        status = 'error';
        statusMessage = 'Délai d\'attente dépassé';
      } else if (error.name === 'TypeError') {
        status = 'invalid';
        statusMessage = 'URL invalide ou problème réseau';
      }
      
      // Gérer les cas spéciaux
      if (url.includes('facebook.com') && status === 'invalid') {
        status = 'warning';
        statusMessage = 'Les liens Facebook peuvent être valides même s\'ils ne sont pas vérifiables';
      }
      
      // Gestion spéciale pour les domaines problématiques
      if (isProblematic) {
        status = 'warning';
        statusMessage = `Site potentiellement protégé: ${statusMessage}`;
      }
      
      return {
        url,
        status,
        statusMessage,
        isProblematicDomain: isProblematic,
        timestamp: new Date().toISOString()
      };
    }
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
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
      
      const response = await fetch(linkResult.finalUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        credentials: 'omit',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return { 
          anchorChecked: true, 
          anchorValid: false, 
          anchorName: anchor,
          anchorError: `Impossible de récupérer le contenu (${response.status})` 
        };
      }
      
      const html = await response.text();
      
      // Recherche plus complète dans le HTML
      // 1. Recherche d'ID
      const hasId = new RegExp(`id=["']${anchor}["']`, 'i').test(html);
      
      // 2. Recherche de balise d'ancre
      const hasAnchorTag = new RegExp(`<a[^>]+name=["']${anchor}["'][^>]*>`, 'i').test(html);
      
      // 3. Recherche d'attribut name sur d'autres éléments
      const hasNameAttr = new RegExp(`name=["']${anchor}["']`, 'i').test(html);
      
      // 4. Recherche de liens internes qui correspondent à l'ancre
      const hasInternalLink = new RegExp(`href=["']#${anchor}["']`, 'i').test(html);
      
      return {
        anchorChecked: true,
        anchorValid: hasId || hasAnchorTag || hasNameAttr || hasInternalLink,
        anchorName: anchor,
        anchorDetails: {
          hasId,
          hasAnchorTag,
          hasNameAttr,
          hasInternalLink
        }
      };
      
    } catch (error) {
      return { 
        anchorChecked: true, 
        anchorValid: false, 
        anchorName: url.split('#')[1] || '',
        anchorError: error.message 
      };
    }
  }
  
  /**
   * Vérifie une liste d'images
   * @param {string[]} images - Liste des images à vérifier
   * @param {number} tabId - ID de l'onglet
   * @param {Object} options - Options de vérification
   */
  async function checkImages(images, tabId, options) {
    // Si aucune image, vérification désactivée ou vérification arrêtée, terminer
    if (images.length === 0 || !options.checkImages || checkAborted) return;
    
    // Limiter la concurrence
    const concurrency = options.concurrency || 3; // Concurrence plus faible pour les images
    const queue = [...images];
    const activePromises = new Set();
    let processed = 0;
    
    while (queue.length > 0 && !checkAborted) {
      // Traiter jusqu'à concurrency images à la fois
      while (activePromises.size < concurrency && queue.length > 0 && !checkAborted) {
        const url = queue.shift();
        
        const promise = checkImage(url, options)
          .then(result => {
            processed++;
            activePromises.delete(promise);
            
            // Ajouter le résultat
            currentResults.images.push(result);
            
            // Envoyer le résultat et la mise à jour de progression
            sendAddResult('image', result);
            sendProgressUpdate({
              processed,
              total: images.length,
              type: 'images'
            });
            
            return result;
          })
          .catch(error => {
            processed++;
            activePromises.delete(promise);
            
            // Créer un résultat d'erreur
            const errorResult = {
              url,
              status: 'error',
              statusMessage: error.message,
              timestamp: new Date().toISOString()
            };
            
            // Ajouter le résultat
            currentResults.images.push(errorResult);
            
            // Envoyer le résultat et la mise à jour de progression
            sendAddResult('image', errorResult);
            sendProgressUpdate({
              processed,
              total: images.length,
              type: 'images'
            });
          });
        
        activePromises.add(promise);
      }
      
      // Attendre qu'au moins une promesse se termine
      if (activePromises.size > 0 && !checkAborted) {
        await Promise.race(Array.from(activePromises));
      }
    }
    
    // Attendre que toutes les promesses actives se terminent
    if (activePromises.size > 0 && !checkAborted) {
      await Promise.all(Array.from(activePromises));
    }
  }
  
  /**
   * Vérifie une image unique
   * @param {string} url - URL de l'image à vérifier
   * @param {Object} options - Options de vérification
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  async function checkImage(url, options) {
    const timeout = options.timeout || 15000; // Timeout plus long pour les images
    
    try {
      // Traitement spécial pour les URLs de données
      if (url.startsWith('data:')) {
        return processDataUrl(url);
      }
      
      // Vérifier si le domaine est problématique
      const isProblematic = isProblematicDomain(url);
      
      // Créer un controller pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Préparer les en-têtes
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // Faire la requête - essayer avec mode cors d'abord
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          credentials: 'omit',
          mode: 'cors',
          headers: headers
        }).catch(async (error) => {
          // Si HEAD échoue, essayer GET
          if (error.name === 'TypeError') {
            return fetch(url, {
              method: 'GET',
              redirect: 'follow',
              signal: controller.signal,
              credentials: 'omit',
              mode: 'cors',
              headers: headers
            });
          }
          throw error;
        });
        
        // Annuler le timeout
        clearTimeout(timeoutId);
        
        // Vérifier le type MIME
        const contentType = response.headers.get('content-type') || '';
        const isImage = contentType.startsWith('image/');
        
        // Traiter la réponse
        const result = {
          url,
          finalUrl: response.url,
          statusCode: response.status,
          statusMessage: response.statusText,
          status: isImage ? categorizeStatusCode(response.status) : 'invalid',
          contentType,
          contentLength: response.headers.get('content-length'),
          isImage,
          timestamp: new Date().toISOString(),
          isProblematicDomain: isProblematic
        };
        
        if (!isImage && result.status === 'success') {
          result.status = 'invalid';
          result.statusMessage = 'Le contenu n\'est pas une image';
        }
        
        return result;
      } catch (corsError) {
        // Si on a une erreur CORS, essayer avec no-cors
        const isCorsIssue = corsError.name === 'TypeError' && 
                          (corsError.message.includes('CORS') || 
                           corsError.message.includes('cross-origin') || 
                           corsError.message.includes('opaque response') ||
                           corsError.message.includes('network error'));
                           
        if (isCorsIssue) {
          // Réinitialiser le controller pour un nouveau timeout
          controller.abort();
          const newController = new AbortController();
          const newTimeoutId = setTimeout(() => newController.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              redirect: 'follow',
              signal: newController.signal,
              credentials: 'omit',
              mode: 'no-cors', // Essayer en mode no-cors
              headers: headers
            });
            
            clearTimeout(newTimeoutId);
            
            // En mode no-cors, on ne peut pas accéder aux en-têtes,
            // donc on présume que c'est une image si la requête réussit
            return {
              url,
              finalUrl: url, // On ne peut pas savoir l'URL finale en mode no-cors
              status: 'success',
              statusMessage: 'Image accessible (mode no-cors)',
              isImage: true,
              noCorsModeUsed: true,
              timestamp: new Date().toISOString(),
              isProblematicDomain: isProblematic
            };
          } catch (noCorsError) {
            clearTimeout(newTimeoutId);
            
            // Utiliser la méthode alternative avec un élément Image
            try {
              return await checkImageWithElement(url);
            } catch (imgError) {
              // Si toutes les méthodes échouent, renvoyer l'erreur CORS originale
              throw {
                name: corsError.name,
                message: corsError.message,
                isCorsBlocked: true
              };
            }
          }
        } else {
          // Si ce n'est pas une erreur CORS, relancer l'erreur
          throw corsError;
        }
      }
      
    } catch (error) {
      // Gérer les erreurs spécifiques
      let status = 'error';
      let statusMessage = error.message;
      let isCorsBlocked = error.isCorsBlocked || 
                       (error.name === 'TypeError' && 
                        (error.message.includes('CORS') || 
                         error.message.includes('cross-origin')));
      
      if (error.name === 'AbortError') {
        status = 'error';
        statusMessage = 'Délai d\'attente dépassé';
      } else if (isCorsBlocked) {
        status = 'warning';
        statusMessage = 'Blocage CORS - Accès refusé par la politique cross-origin';
      } else if (error.name === 'TypeError' && !isCorsBlocked) {
        status = 'invalid';
        statusMessage = 'URL invalide ou problème réseau';
      }
      
      const isProblematic = isProblematicDomain(url);
      
      return {
        url,
        status,
        statusMessage,
        isCorsBlocked,
        isProblematicDomain: isProblematic,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Vérifie une image en utilisant un élément Image
   * Méthode alternative qui peut fonctionner dans certains cas de CORS
   * @param {string} url - URL de l'image
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  function checkImageWithElement(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error('Délai d\'attente dépassé'));
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        resolve({
          url,
          status: 'success',
          statusMessage: 'Image chargée avec succès (via élément Image)',
          isImage: true,
          imageDimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight
          },
          alternativeMethod: true,
          timestamp: new Date().toISOString()
        });
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Impossible de charger l\'image'));
      };
      
      // Activer le chargement de l'image
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }
  
  /**
   * Traite les URLs de données
   * @param {string} dataUrl - URL de données à traiter
   * @returns {Object} - Résultat du traitement
   */
  function processDataUrl(dataUrl) {
    try {
      // Vérifier le format de l'URL de données
      const matches = dataUrl.match(/^data:([^;]+);([^,]+),(.*)$/);
      if (!matches) {
        return {
          url: dataUrl.substring(0, 30) + '...',
          status: 'invalid',
          statusMessage: 'Format d\'URL de données invalide',
          timestamp: new Date().toISOString()
        };
      }
      
      const mimeType = matches[1];
      const encoding = matches[2];
      const isImage = mimeType.startsWith('image/');
      
      // Pour les data URLs d'images, on peut créer un élément Image pour obtenir les dimensions
      if (isImage) {
        return new Promise((resolve) => {
          const img = new Image();
          
          img.onload = () => {
            resolve({
              url: dataUrl.substring(0, 30) + '...',
              status: 'success',
              statusMessage: 'URL de données d\'image valide',
              contentType: mimeType,
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
              url: dataUrl.substring(0, 30) + '...',
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
      
      // Estimer la taille pour base64
      let sizeInBytes = 0;
      if (encoding === 'base64') {
        const data = matches[3];
        sizeInBytes = Math.ceil((data.length * 3) / 4);
      }
      
      return {
        url: dataUrl.substring(0, 30) + '...',
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
        url: dataUrl.substring(0, 30) + '...',
        status: 'error',
        statusMessage: `Erreur lors du traitement de l'URL de données: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Envoie une mise à jour de progression
   * @param {Object} data - Données de progression
   */
  function sendProgressUpdate(data) {
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      data
    });
  }
  
  /**
   * Envoie l'ajout d'un résultat
   * @param {string} type - Type de résultat (link ou image)
   * @param {Object} result - Résultat à ajouter
   */
  function sendAddResult(type, result) {
    chrome.runtime.sendMessage({
      action: 'addResult',
      data: { type, result }
    });
  }
  
  /**
   * Envoie que la vérification est terminée
   * @param {Object} [data] - Données additionnelles
   */
  function sendCheckComplete(data = {}) {
    chrome.runtime.sendMessage({
      action: 'checkComplete',
      data: {
        ...data,
        results: currentResults,
        timestamp: scanTimestamp
      }
    });
  }