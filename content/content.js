/**
 * Script de contenu pour l'extension Link & Image Checker
 * 
 * Ce script s'exécute dans le contexte de la page web et permet 
 * d'interagir directement avec le DOM de la page.
 */

// Écouter les messages du script d'arrière-plan
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'collectUrls') {
      const result = collectPageUrls();
      sendResponse(result);
      return true;
    } else if (message.action === 'checkAnchor') {
      const result = checkAnchorInPage(message.anchor);
      sendResponse(result);
      return true;
    } else if (message.action === 'highlightElement') {
      highlightElement(message.selector, message.status);
      sendResponse({ success: true });
      return true;
    }
  });
  
  /**
   * Collecte toutes les URLs de liens et d'images sur la page
   * @returns {Object} - Les URLs collectées
   */
  function collectPageUrls() {
    const pageUrl = window.location.href;
    const links = [];
    const images = [];
    
    // Collecter tous les liens avec leur texte
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const href = a.href;
        if (href && !href.startsWith('javascript:') && !links.some(l => l.url === href)) {
          links.push({
            url: href,
            text: a.textContent.trim(),
            selector: generateSelector(a)
          });
        }
      } catch (e) {
        // Ignorer les erreurs d'URL invalides
      }
    });
    
    // Collecter toutes les images
    document.querySelectorAll('img[src]').forEach(img => {
      try {
        const src = img.src;
        if (src && !images.some(i => i.url === src)) {
          images.push({
            url: src,
            alt: img.alt || '',
            selector: generateSelector(img),
            dimensions: {
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height
            }
          });
        }
      } catch (e) {
        // Ignorer les erreurs d'URL invalides
      }
    });
    
    // Collecter les images d'arrière-plan
    const bgElements = document.querySelectorAll('*');
    bgElements.forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        let bgImage = style.backgroundImage;
        
        if (bgImage && bgImage !== 'none') {
          // Extraire l'URL de la forme url("...")
          const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/i);
          if (match && match[1] && !images.some(i => i.url === match[1])) {
            images.push({
              url: match[1],
              isBgImage: true,
              selector: generateSelector(el)
            });
          }
        }
      } catch (e) {
        // Ignorer les erreurs
      }
    });
    
    return { links, images, pageUrl };
  }
  
  /**
   * Vérifie si une ancre existe dans la page
   * @param {string} anchorName - Nom de l'ancre
   * @returns {Object} - Résultat de la vérification
   */
  function checkAnchorInPage(anchorName) {
    if (!anchorName) {
      return { 
        anchorChecked: false 
      };
    }
    
    // Essayer de trouver l'élément par ID
    const elementById = document.getElementById(anchorName);
    if (elementById) {
      return {
        anchorChecked: true,
        anchorValid: true,
        anchorName,
        selector: generateSelector(elementById)
      };
    }
    
    // Essayer de trouver l'élément par name (pour les ancres <a name="...">)
    const elementsByName = document.getElementsByName(anchorName);
    if (elementsByName.length > 0) {
      return {
        anchorChecked: true,
        anchorValid: true,
        anchorName,
        selector: generateSelector(elementsByName[0])
      };
    }
    
    return {
      anchorChecked: true,
      anchorValid: false,
      anchorName
    };
  }
  
  /**
   * Met en évidence un élément sur la page
   * @param {string} selector - Sélecteur CSS
   * @param {string} status - Statut (success, warning, error)
   */
  function highlightElement(selector, status) {
    // Supprimer les surbrillances précédentes
    const previousHighlights = document.querySelectorAll('.link-checker-highlight');
    previousHighlights.forEach(el => el.remove());
    
    try {
      const element = document.querySelector(selector);
      if (!element) return;
      
      // Obtenir la position de l'élément
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Créer un élément de surbrillance
      const highlight = document.createElement('div');
      highlight.className = 'link-checker-highlight';
      
      // Définir la couleur selon le statut
      let color;
      if (status === 'success') color = 'rgba(15, 157, 88, 0.3)';
      else if (status === 'warning') color = 'rgba(244, 160, 0, 0.3)';
      else color = 'rgba(219, 68, 55, 0.3)';
      
      // Appliquer les styles
      highlight.style.cssText = `
        position: absolute;
        top: ${rect.top + scrollTop}px;
        left: ${rect.left + scrollLeft}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background-color: ${color};
        border: 2px solid ${color.replace('0.3', '1')};
        border-radius: 3px;
        z-index: 9999;
        pointer-events: none;
        animation: link-checker-pulse 1.5s infinite;
      `;
      
      // Créer une animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes link-checker-pulse {
          0% { opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { opacity: 0.8; }
        }
      `;
      
      // Ajouter à la page
      document.head.appendChild(style);
      document.body.appendChild(highlight);
      
      // Faire défiler jusqu'à l'élément
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Supprimer la surbrillance après 3 secondes
      setTimeout(() => {
        highlight.remove();
      }, 3000);
      
    } catch (e) {
      console.error('Erreur lors de la mise en évidence:', e);
    }
  }
  
  /**
   * Génère un sélecteur CSS pour un élément
   * @param {Element} element - Élément DOM
   * @returns {string} - Sélecteur CSS
   */
  function generateSelector(element) {
    if (!element) return '';
    
    let selector = '';
    
    // Utiliser l'ID si disponible
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Essayer d'utiliser des classes uniques
    if (element.className) {
      const classes = element.className.split(/\s+/).filter(c => c);
      if (classes.length) {
        // Vérifier si une des classes est unique
        for (const className of classes) {
          if (document.getElementsByClassName(className).length === 1) {
            return `.${className}`;
          }
        }
        
        // Sinon utiliser toutes les classes
        selector = '.' + classes.join('.');
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