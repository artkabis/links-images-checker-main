/**
 * Module principal pour l'extension Link & Image Checker
 * Unifie les fonctionnalités de vérification de liens et d'images
 */

import { checkLink, checkLinks, DEFAULT_LINK_OPTIONS } from './checkLinks.js';
import { checkImage, checkImages, DEFAULT_IMAGE_OPTIONS } from './checkImages.js';
import { isImageUrl } from './utils.js';

/**
 * Options par défaut pour la vérification combinée
 */
export const DEFAULT_OPTIONS = {
  // Fusion des options par défaut des deux modules
  ...DEFAULT_LINK_OPTIONS,
  ...DEFAULT_IMAGE_OPTIONS,
  
  // Options spécifiques à la vérification combinée
  separateImageResults: true, // Séparer les résultats par type (liens/images)
  classifyUrlTypes: true,     // Déterminer automatiquement si une URL est une image
  analyzeHtmlImages: false    // Analyser les balises <img> dans le HTML
};

/**
 * Vérifie une combinaison de liens et d'images
 * @param {string[]} urls - Tableau d'URLs à vérifier
 * @param {Object} [options={}] - Options de configuration
 * @param {Function} [progressCallback] - Callback optionnel pour les mises à jour de progression
 * @returns {Promise<Object>} - Résultats de toutes les vérifications
 */
export async function checkAll(urls, options = {}, progressCallback = null) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Classification des URLs
  const linkUrls = [];
  const imageUrls = [];
  
  if (opts.classifyUrlTypes) {
    urls.forEach(url => {
      if (isImageUrl(url)) {
        imageUrls.push(url);
      } else {
        linkUrls.push(url);
      }
    });
  } else {
    // Si pas de classification, considérer toutes les URLs comme des liens
    linkUrls.push(...urls);
  }
  
  let linkResults = [];
  let imageResults = [];
  let progress = { processed: 0, total: urls.length };
  
  // Wrapper pour le callback de progression
  const handleProgress = (source, result, currentProgress) => {
    const totalProcessed = 
      (linkResults.length + (source === 'link' ? 1 : 0)) + 
      (imageResults.length + (source === 'image' ? 1 : 0));
    
    progress.processed = totalProcessed;
    
    if (progressCallback && typeof progressCallback === 'function') {
      progressCallback({
        ...progress,
        source,
        result,
        linkProgress: linkResults.length + (source === 'link' ? 1 : 0),
        imageProgress: imageResults.length + (source === 'image' ? 1 : 0),
        ...currentProgress
      });
    }
  };
  
  // Vérification des liens
  const linkProgressCallback = result => {
    handleProgress('link', result, { 
      linkTotal: linkUrls.length, 
      imageTotal: imageUrls.length 
    });
  };
  
  // Vérification des images
  const imageProgressCallback = result => {
    handleProgress('image', result, { 
      linkTotal: linkUrls.length, 
      imageTotal: imageUrls.length 
    });
  };
  
  // Vérification parallèle des liens et des images
  const [links, images] = await Promise.all([
    checkLinks(linkUrls, opts, linkProgressCallback),
    checkImages(imageUrls, opts, imageProgressCallback)
  ]);
  
  linkResults = links;
  imageResults = images;
  
  // Formatage des résultats selon les options
  const results = {
    links: linkResults,
    images: imageResults,
    summary: {
      totalLinks: linkResults.length,
      totalImages: imageResults.length,
      successfulLinks: linkResults.filter(r => r.status === 'success').length,
      successfulImages: imageResults.filter(r => r.status === 'success').length,
      timestamp: new Date().toISOString()
    }
  };
  
  return results;
}

// Exporter les fonctions individuelles pour un accès direct
export {
  checkLink,
  checkLinks,
  checkImage,
  checkImages
};