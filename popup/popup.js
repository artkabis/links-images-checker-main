/**
 * Script principal de l'interface popup pour l'extension Link & Image Checker (Version améliorée)
 */

// Variables globales
let currentTabId = null;
let checkInProgress = false;
let results = {
  links: [],
  images: []
};
let scanTimestamp = null;
let currentFilter = 'all'; // Filtre actuel: 'all', 'error', 'warning', 'success'
let currentSort = 'status'; // Tri actuel: 'status', 'url', 'type'
let currentSortDirection = 'asc'; // Direction du tri: 'asc', 'desc'
let lastScrollPosition = 0; // Pour mémoriser la position de défilement

// Récupérer les éléments DOM
const startCheckButton = document.getElementById('start-check');
const stopCheckButton = document.getElementById('stop-check');
const exportResultsButton = document.getElementById('export-results');
const progressContainer = document.querySelector('.progress-container');
const progressText = document.getElementById('progress-text');
const progressStats = document.getElementById('progress-stats');
const progressBar = document.getElementById('progress-bar');
const summaryContainer = document.querySelector('.summary-container');
const totalCount = document.getElementById('total-count');
const successCount = document.getElementById('success-count');
const warningCount = document.getElementById('warning-count');
const errorCount = document.getElementById('error-count');
const allResultsTab = document.getElementById('results-all');
const linksResultsTab = document.getElementById('results-links');
const imagesResultsTab = document.getElementById('results-images');
const lastScanInfo = document.getElementById('last-scan-info');
const filterDropdown = document.getElementById('filter-results');
const sortDropdown = document.getElementById('sort-results');
const searchInput = document.getElementById('search-results');
const clearSearchButton = document.getElementById('clear-search');
const expandAllButton = document.getElementById('expand-all');
const collapseAllButton = document.getElementById('collapse-all');

// Options
const concurrencyInput = document.getElementById('concurrency');
const timeoutInput = document.getElementById('timeout');
const checkImagesCheckbox = document.getElementById('check-images');
const checkExternalCheckbox = document.getElementById('check-external');
const checkAnchorsCheckbox = document.getElementById('check-anchors');
const userAgentSelect = document.getElementById('user-agent');
const followRedirectsCheckbox = document.getElementById('follow-redirects');
const maxRedirectsInput = document.getElementById('max-redirects');

// Onglets
const tabButtons = document.querySelectorAll('.tab-button');
const resultsTabs = document.querySelectorAll('.results-tab');

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  // Obtenir l'onglet actif
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tabs[0].id;

  // Charger les options depuis le stockage
  chrome.storage.local.get(['options'], (data) => {
    if (data.options) {
      concurrencyInput.value = data.options.concurrency || 5;
      timeoutInput.value = data.options.timeout || 10000;
      checkImagesCheckbox.checked = data.options.checkImages !== false;
      checkExternalCheckbox.checked = data.options.checkExternal !== false;
      checkAnchorsCheckbox.checked = data.options.checkAnchors || false;
      
      // Nouvelles options
      if (userAgentSelect) {
        userAgentSelect.value = data.options.userAgent || 'default';
      }
      if (followRedirectsCheckbox) {
        followRedirectsCheckbox.checked = data.options.followRedirects !== false;
      }
      if (maxRedirectsInput) {
        maxRedirectsInput.value = data.options.maxRedirects || 5;
      }
    }
  });

  // Vérifier s'il y a des résultats en cours pour l'onglet actif
  chrome.storage.local.get(['checkInProgress', 'results', 'tabId', 'scanTimestamp'], (data) => {
    // Seulement restaurer l'état si le tabId correspond
    if (data.checkInProgress && data.tabId === currentTabId) {
      checkInProgress = true;
      updateUIForCheckInProgress();
    }
    
    // Seulement restaurer les résultats si le tabId correspond
    if (data.results && data.tabId === currentTabId && data.scanTimestamp) {
      results = data.results;
      scanTimestamp = data.scanTimestamp;
      updateResultsUI();
      updateLastScanInfo();
    } else {
      resetResults();
    }
  });

  // Configuration des écouteurs d'événements
  setupEventListeners();
  setupThemeToggle();
});

function setupEventListeners() {
  // Boutons de contrôle
  startCheckButton.addEventListener('click', startCheck);
  stopCheckButton.addEventListener('click', stopCheck);
  exportResultsButton.addEventListener('click', exportResults);

  // Changement d'onglets
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.id.replace('tab-', '');
      setActiveTab(tabId);
      // Mémoriser la position de défilement actuelle
      saveScrollPosition();
    });
  });

  // Changements d'options
  concurrencyInput.addEventListener('change', saveOptions);
  timeoutInput.addEventListener('change', saveOptions);
  checkImagesCheckbox.addEventListener('change', saveOptions);
  checkExternalCheckbox.addEventListener('change', saveOptions);
  checkAnchorsCheckbox.addEventListener('change', saveOptions);
  
  // Nouvelles options
  if (userAgentSelect) {
    userAgentSelect.addEventListener('change', saveOptions);
  }
  if (followRedirectsCheckbox) {
    followRedirectsCheckbox.addEventListener('change', saveOptions);
    
    // Activer/désactiver le champ maxRedirects selon l'état de followRedirects
    followRedirectsCheckbox.addEventListener('change', () => {
      if (maxRedirectsInput) {
        maxRedirectsInput.disabled = !followRedirectsCheckbox.checked;
      }
    });
  }
  if (maxRedirectsInput) {
    maxRedirectsInput.addEventListener('change', saveOptions);
  }

  // Filtres et tri
  if (filterDropdown) {
    filterDropdown.addEventListener('change', () => {
      currentFilter = filterDropdown.value;
      updateResultsUI();
      restoreScrollPosition();
    });
  }
  
  if (sortDropdown) {
    sortDropdown.addEventListener('change', () => {
      // Si on sélectionne le même critère, on inverse la direction
      if (currentSort === sortDropdown.value) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = sortDropdown.value;
        // Par défaut: status et type en ascendant, url en descendant
        currentSortDirection = (currentSort === 'url') ? 'asc' : 'desc';
      }
      
      updateResultsUI();
      restoreScrollPosition();
    });
  }
  
  // Recherche
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateResultsUI();
      // Ne pas restaurer la position de défilement lors d'une recherche
    });
    
    // Effacer la recherche
    if (clearSearchButton) {
      clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        updateResultsUI();
      });
    }
  }
  
  // Boutons pour développer/réduire tous les résultats
  if (expandAllButton) {
    expandAllButton.addEventListener('click', () => {
      document.querySelectorAll('.result-item').forEach(item => {
        item.classList.add('expanded');
      });
    });
  }
  
  if (collapseAllButton) {
    collapseAllButton.addEventListener('click', () => {
      document.querySelectorAll('.result-item').forEach(item => {
        item.classList.remove('expanded');
      });
    });
  }

  // Écouter les messages du script d'arrière-plan
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateProgress') {
      updateProgress(message.data);
    } else if (message.action === 'checkComplete') {
      handleCheckComplete(message.data);
    } else if (message.action === 'addResult') {
      addResult(message.data);
    }
  });
  
  // Gérer les clics sur les éléments de résultats (délégation d'événements)
  document.addEventListener('click', handleResultItemClick);
}

function handleResultItemClick(event) {
  // Vérifier si un élément de résultat ou un bouton d'action a été cliqué
  const resultItem = event.target.closest('.result-item');
  
  // Si on a cliqué sur un élément de résultat (mais pas sur un bouton d'action)
  if (resultItem && !event.target.closest('.result-action-button')) {
    // Basculer la classe expanded pour afficher/masquer les détails
    resultItem.classList.toggle('expanded');
    return;
  }
  
  // Si on a cliqué sur le bouton "Mettre en évidence"
  if (event.target.closest('.highlight-button')) {
    const resultItem = event.target.closest('.result-item');
    if (resultItem) {
      const selector = resultItem.dataset.selector;
      const status = resultItem.dataset.status;
      if (selector) {
        highlightElementInPage(selector, status);
      }
    }
    return;
  }
  
  // Si on a cliqué sur le bouton "Ouvrir dans un nouvel onglet"
  if (event.target.closest('.open-button')) {
    const resultItem = event.target.closest('.result-item');
    if (resultItem) {
      const url = resultItem.dataset.url;
      if (url) {
        window.open(url, '_blank');
      }
    }
    return;
  }
  
  // Si on a cliqué sur le bouton "Copier l'URL"
  if (event.target.closest('.copy-button')) {
    const resultItem = event.target.closest('.result-item');
    if (resultItem) {
      const url = resultItem.dataset.url;
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          // Feedback visuel pour indiquer que l'URL a été copiée
          const copyButton = resultItem.querySelector('.copy-button');
          const originalText = copyButton.textContent;
          copyButton.textContent = 'Copié!';
          setTimeout(() => {
            copyButton.textContent = originalText;
          }, 1500);
        });
      }
    }
    return;
  }
}

function saveOptions() {
  const options = {
    concurrency: parseInt(concurrencyInput.value),
    timeout: parseInt(timeoutInput.value),
    checkImages: checkImagesCheckbox.checked,
    checkExternal: checkExternalCheckbox.checked,
    checkAnchors: checkAnchorsCheckbox.checked
  };
  
  // Nouvelles options
  if (userAgentSelect) {
    options.userAgent = userAgentSelect.value;
  }
  if (followRedirectsCheckbox) {
    options.followRedirects = followRedirectsCheckbox.checked;
  }
  if (maxRedirectsInput) {
    options.maxRedirects = parseInt(maxRedirectsInput.value);
  }

  chrome.storage.local.set({ options });
}

function resetResults() {
  results = {
    links: [],
    images: []
  };
  scanTimestamp = null;
  
  // Réinitialiser les filtres et tri
  currentFilter = 'all';
  if (filterDropdown) filterDropdown.value = 'all';
  currentSort = 'status';
  if (sortDropdown) sortDropdown.value = 'status';
  currentSortDirection = 'asc';
  if (searchInput) searchInput.value = '';
  
  // Réinitialiser l'affichage
  allResultsTab.innerHTML = '<div class="no-results">Aucun résultat. Cliquez sur "Vérifier la page" pour commencer.</div>';
  linksResultsTab.innerHTML = '<div class="no-results">Aucun lien vérifié.</div>';
  imagesResultsTab.innerHTML = '<div class="no-results">Aucune image vérifiée.</div>';
  
  // Cacher le résumé
  summaryContainer.style.display = 'none';
  
  // Réinitialiser l'info de dernière analyse
  if (lastScanInfo) {
    lastScanInfo.textContent = '';
    lastScanInfo.style.display = 'none';
  }
  
  // Désactiver le bouton d'exportation et les filtres
  exportResultsButton.disabled = true;
  if (filterDropdown) filterDropdown.disabled = true;
  if (sortDropdown) sortDropdown.disabled = true;
  if (searchInput) searchInput.disabled = true;
  if (clearSearchButton) clearSearchButton.disabled = true;
  if (expandAllButton) expandAllButton.disabled = true;
  if (collapseAllButton) collapseAllButton.disabled = true;
}

async function startCheck() {
  // Récupérer les options
  const options = {
    concurrency: parseInt(concurrencyInput.value),
    timeout: parseInt(timeoutInput.value),
    checkImages: checkImagesCheckbox.checked,
    checkExternal: checkExternalCheckbox.checked,
    checkAnchors: checkAnchorsCheckbox.checked
  };
  
  // Nouvelles options
  if (userAgentSelect) {
    options.userAgent = getUserAgentString(userAgentSelect.value);
  }
  if (followRedirectsCheckbox) {
    options.followRedirects = followRedirectsCheckbox.checked;
  }
  if (maxRedirectsInput) {
    options.maxRedirects = parseInt(maxRedirectsInput.value);
  }

  // Réinitialiser les résultats pour la nouvelle analyse
  resetResults();
  
  // Créer un nouveau timestamp pour cette analyse
  scanTimestamp = new Date().toISOString();
  
  // Mettre à jour le statut
  checkInProgress = true;
  updateUIForCheckInProgress();
  
  // Stocker le statut avec l'ID de l'onglet
  chrome.storage.local.set({ 
    checkInProgress: true,
    results: results,
    tabId: currentTabId,
    scanTimestamp: scanTimestamp
  });

  // Envoyer la commande au script d'arrière-plan
  chrome.runtime.sendMessage({
    action: 'startCheck',
    tabId: currentTabId,
    options: options,
    timestamp: scanTimestamp
  });
}

function getUserAgentString(userAgentType) {
  // Définir différents user-agents selon le type choisi
  const userAgents = {
    'default': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'chrome-desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'firefox-desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
    'safari-desktop': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'edge-desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.46',
    'chrome-mobile': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
    'safari-mobile': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'curl': 'curl/7.88.1'
  };
  
  return userAgents[userAgentType] || userAgents['default'];
}

function stopCheck() {
  chrome.runtime.sendMessage({
    action: 'stopCheck',
    tabId: currentTabId
  });
  
  // Mettre à jour le statut
  checkInProgress = false;
  updateUIForCheckComplete();
  
  // Stocker le statut
  chrome.storage.local.set({ 
    checkInProgress: false 
  });
}

function exportResults() {
  // Détecter le format d'exportation (nouveau)
  const exportFormat = document.getElementById('export-format') ? 
    document.getElementById('export-format').value : 'json';
  
  if (exportFormat === 'csv') {
    exportToCsv();
  } else if (exportFormat === 'html') {
    exportToHtml();
  } else {
    exportToJson(); // Format par défaut
  }
}

function exportToJson() {
  // Créer des données d'exportation enrichies
  const exportData = {
    timestamp: scanTimestamp,
    url: null, // Sera rempli ci-dessous
    summary: {
      total: results.links.length + results.images.length,
      links: results.links.length,
      images: results.images.length,
      success: results.links.filter(r => r.status === 'success').length + 
               results.images.filter(r => r.status === 'success').length,
      warnings: results.links.filter(r => ['redirect', 'warning', 'skipped'].includes(r.status)).length + 
                results.images.filter(r => ['redirect', 'warning', 'skipped'].includes(r.status)).length,
      errors: results.links.filter(r => ['error', 'clientError', 'serverError', 'invalid'].includes(r.status)).length + 
              results.images.filter(r => ['error', 'clientError', 'serverError', 'invalid'].includes(r.status)).length
    },
    results: {
      links: results.links,
      images: results.images
    }
  };

  // Obtenir l'URL de la page
  chrome.tabs.get(currentTabId, (tab) => {
    exportData.url = tab.url;
    
    // Créer un blob avec les résultats au format JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement et le cliquer
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-check-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    
    // Nettoyer
    URL.revokeObjectURL(url);
  });
}

function exportToCsv() {
  // Préparer les en-têtes CSV
  const headers = [
    "Type", "URL", "Status", "Status Code", "Content Type", 
    "Final URL", "Is Image", "Protocol", "Details", "Timestamp"
  ];
  
  // Préparer les lignes de données
  const rows = [];
  
  // Ajouter les liens
  results.links.forEach(link => {
    rows.push([
      "link",
      link.url,
      link.status,
      link.statusCode || "",
      link.contentType || "",
      link.finalUrl || link.url,
      "false",
      link.protocol || extractProtocolFromUrl(link.url),
      link.statusMessage || "",
      link.timestamp
    ]);
  });
  
  // Ajouter les images
  results.images.forEach(image => {
    rows.push([
      "image",
      image.url,
      image.status,
      image.statusCode || "",
      image.contentType || "",
      image.finalUrl || image.url,
      "true",
      extractProtocolFromUrl(image.url),
      image.statusMessage || "",
      image.timestamp
    ]);
  });
  
  // Échapper les valeurs CSV et former le contenu
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(value => {
      // Échapper les virgules et les guillemets
      const stringValue = String(value || "");
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(','))
  ].join('\n');
  
  // Créer un blob et télécharger
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  chrome.tabs.get(currentTabId, (tab) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-check-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

function exportToHtml() {
  // Créer un modèle HTML avec des styles intégrés
  chrome.tabs.get(currentTabId, (tab) => {
    const pageUrl = tab.url;
    const pageTitle = tab.title;
    const reportDate = new Date().toLocaleString();
    
    // Statistiques
    const totalLinks = results.links.length;
    const totalImages = results.images.length;
    const totalSuccess = results.links.filter(r => r.status === 'success').length + 
                         results.images.filter(r => r.status === 'success').length;
    const totalWarnings = results.links.filter(r => ['redirect', 'warning', 'skipped'].includes(r.status)).length + 
                          results.images.filter(r => ['redirect', 'warning', 'skipped'].includes(r.status)).length;
    const totalErrors = results.links.filter(r => ['error', 'clientError', 'serverError', 'invalid'].includes(r.status)).length + 
                        results.images.filter(r => ['error', 'clientError', 'serverError', 'invalid'].includes(r.status)).length;
    
    // Créer les lignes pour les liens
    let linksHtml = '';
    results.links.forEach(link => {
      const statusClass = getStatusClass(link.status);
      linksHtml += `
        <tr>
          <td>Lien</td>
          <td><a href="${escapeHtml(link.url)}" target="_blank">${truncateUrl(escapeHtml(link.url), 60)}</a></td>
          <td class="${statusClass}">${getStatusText(link.status, link.statusCode)}</td>
          <td>${escapeHtml(link.statusMessage || '')}</td>
          <td>${link.contentType || ''}</td>
        </tr>
      `;
    });
    
    // Créer les lignes pour les images
    let imagesHtml = '';
    results.images.forEach(image => {
      const statusClass = getStatusClass(image.status);
      imagesHtml += `
        <tr>
          <td>Image</td>
          <td><a href="${escapeHtml(image.url)}" target="_blank">${truncateUrl(escapeHtml(image.url), 60)}</a></td>
          <td class="${statusClass}">${getStatusText(image.status, image.statusCode)}</td>
          <td>${escapeHtml(image.statusMessage || '')}</td>
          <td>${image.contentType || ''}</td>
        </tr>
      `;
    });
    
    // Créer le document HTML complet
    const htmlContent = `<!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport Link & Image Checker</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
        .header { margin-bottom: 20px; }
        h1 { color: #1a73e8; margin-bottom: 10px; }
        .info { margin-bottom: 10px; }
        .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-box { padding: 10px 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; min-width: 120px; text-align: center; }
        .stat-label { font-size: 14px; color: #666; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .success-box { background-color: #e6f4ea; color: #0f9d58; }
        .warning-box { background-color: #fef7e0; color: #f9ab00; }
        .error-box { background-color: #fce8e6; color: #ea4335; }
        .total-box { background-color: #e8f0fe; color: #1a73e8; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f1f3f4; padding: 12px; text-align: left; font-weight: bold; }
        td { padding: 10px; border-top: 1px solid #e0e0e0; vertical-align: top; word-break: break-word; }
        tr:hover { background-color: #f8f9fa; }
        .success { color: #0f9d58; }
        .warning { color: #f9ab00; }
        .error { color: #ea4335; }
        
        .tab { overflow: hidden; border: 1px solid #ccc; background-color: #f1f1f1; margin-top: 20px; }
        .tab button { background-color: inherit; float: left; border: none; outline: none; cursor: pointer; padding: 12px 16px; transition: 0.3s; }
        .tab button:hover { background-color: #ddd; }
        .tab button.active { background-color: #1a73e8; color: white; }
        .tabcontent { display: none; padding: 6px 12px; border: 1px solid #ccc; border-top: none; }
        .tabcontent.active { display: block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Rapport de vérification des liens et images</h1>
        <div class="info">
          <p><strong>Page vérifiée:</strong> ${escapeHtml(pageTitle)}</p>
          <p><strong>URL:</strong> <a href="${escapeHtml(pageUrl)}" target="_blank">${escapeHtml(pageUrl)}</a></p>
          <p><strong>Date du rapport:</strong> ${reportDate}</p>
        </div>
      </div>
      
      <div class="summary">
        <div class="stat-box total-box">
          <div class="stat-label">Total</div>
          <div class="stat-value">${totalLinks + totalImages}</div>
        </div>
        <div class="stat-box success-box">
          <div class="stat-label">Réussis</div>
          <div class="stat-value">${totalSuccess}</div>
        </div>
        <div class="stat-box warning-box">
          <div class="stat-label">Avertissements</div>
          <div class="stat-value">${totalWarnings}</div>
        </div>
        <div class="stat-box error-box">
          <div class="stat-label">Erreurs</div>
          <div class="stat-value">${totalErrors}</div>
        </div>
      </div>
      
      <div class="tab">
        <button class="tablinks active" onclick="openTab(event, 'AllTab')">Tous (${totalLinks + totalImages})</button>
        <button class="tablinks" onclick="openTab(event, 'LinksTab')">Liens (${totalLinks})</button>
        <button class="tablinks" onclick="openTab(event, 'ImagesTab')">Images (${totalImages})</button>
      </div>
      
      <div id="AllTab" class="tabcontent active">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>URL</th>
              <th>Statut</th>
              <th>Message</th>
              <th>Type de contenu</th>
            </tr>
          </thead>
          <tbody>
            ${linksHtml}
            ${imagesHtml}
          </tbody>
        </table>
      </div>
      
      <div id="LinksTab" class="tabcontent">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>URL</th>
              <th>Statut</th>
              <th>Message</th>
              <th>Type de contenu</th>
            </tr>
          </thead>
          <tbody>
            ${linksHtml}
          </tbody>
        </table>
      </div>
      
      <div id="ImagesTab" class="tabcontent">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>URL</th>
              <th>Statut</th>
              <th>Message</th>
              <th>Type de contenu</th>
            </tr>
          </thead>
          <tbody>
            ${imagesHtml}
          </tbody>
        </table>
      </div>
      
      <script>
        function openTab(evt, tabName) {
          // Déclarer toutes les variables
          var i, tabcontent, tablinks;
          
          // Masquer tous les contenus d'onglets
          tabcontent = document.getElementsByClassName("tabcontent");
          for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].classList.remove("active");
          }
          
          // Supprimer la classe "active" de tous les boutons d'onglets
          tablinks = document.getElementsByClassName("tablinks");
          for (i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove("active");
          }
          
          // Afficher l'onglet courant et ajouter une classe "active" au bouton qui a ouvert l'onglet
          document.getElementById(tabName).classList.add("active");
          evt.currentTarget.classList.add("active");
        }
      </script>
    </body>
    </html>`;
    
    // Créer un blob et télécharger
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-check-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

// Fonction utilitaire pour échapper les caractères HTML
function escapeHtml(text) {
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

// Fonction utilitaire pour extraire le protocole d'une URL
function extractProtocolFromUrl(url) {
  if (!url) return '';
  
  try {
    if (url.startsWith('#')) return 'fragment';
    
    // Vérifier les protocoles spéciaux
    for (const protocol of ['mailto:', 'tel:', 'javascript:', 'file:', 'ftp:', 'data:']) {
      if (url.toLowerCase().startsWith(protocol)) {
        return protocol.slice(0, -1);
      }
    }
    
    const urlObj = new URL(url);
    return urlObj.protocol.replace(':', '');
  } catch (error) {
    return 'unknown';
  }
}

function updateProgress(progress) {
  // Afficher le conteneur de progression s'il est caché
  progressContainer.style.display = 'block';
  
  // Mettre à jour le texte et la barre de progression
  progressText.textContent = `Vérification en cours... ${progress.type || ''}`;
  progressStats.textContent = `${progress.processed}/${progress.total}`;
  
  // Calculer le pourcentage
  const percentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  progressBar.style.width = `${percentage}%`;
}

function handleCheckComplete(data) {
  checkInProgress = false;
  updateUIForCheckComplete();
  
  // Mettre à jour les résultats avec les données finales
  if (data && data.results) {
    results = data.results;
    scanTimestamp = data.timestamp || scanTimestamp;
    
    chrome.storage.local.set({ 
      results,
      scanTimestamp,
      tabId: currentTabId
    });
    
    updateResultsUI();
    updateLastScanInfo();
  }
  
  // Mettre à jour le statut dans le stockage
  chrome.storage.local.set({ checkInProgress: false });
}

function addResult(data) {
  if (data.type === 'link') {
    results.links.push(data.result);
  } else if (data.type === 'image') {
    results.images.push(data.result);
  }
  
  // Stocker les résultats mis à jour
  chrome.storage.local.set({ 
    results,
    tabId: currentTabId,
    scanTimestamp
  });
  
  // Mettre à jour l'interface utilisateur
  updateResultsUI();
}

function updateUIForCheckInProgress() {
  startCheckButton.disabled = true;
  stopCheckButton.disabled = false;
  exportResultsButton.disabled = true;
  progressContainer.style.display = 'block';
  
  // Désactiver les contrôles de filtrage
  if (filterDropdown) filterDropdown.disabled = true;
  if (sortDropdown) sortDropdown.disabled = true;
  if (searchInput) searchInput.disabled = true;
  if (clearSearchButton) clearSearchButton.disabled = true;
  if (expandAllButton) expandAllButton.disabled = true;
  if (collapseAllButton) collapseAllButton.disabled = true;
  
  // Réinitialiser l'affichage des résultats
  allResultsTab.innerHTML = '<div class="no-results">Vérification en cours...</div>';
  linksResultsTab.innerHTML = '<div class="no-results">Vérification en cours...</div>';
  imagesResultsTab.innerHTML = '<div class="no-results">Vérification en cours...</div>';
}

function updateUIForCheckComplete() {
  startCheckButton.disabled = false;
  stopCheckButton.disabled = true;
  exportResultsButton.disabled = false;
  progressContainer.style.display = 'none';
  
  // Activer les contrôles de filtrage s'il y a des résultats
  const hasResults = results.links.length > 0 || results.images.length > 0;
  if (filterDropdown) filterDropdown.disabled = !hasResults;
  if (sortDropdown) sortDropdown.disabled = !hasResults;
  if (searchInput) searchInput.disabled = !hasResults;
  if (clearSearchButton) clearSearchButton.disabled = !hasResults;
  if (expandAllButton) expandAllButton.disabled = !hasResults;
  if (collapseAllButton) collapseAllButton.disabled = !hasResults;
}

function updateLastScanInfo() {
  if (!lastScanInfo || !scanTimestamp) return;
  
  const scanDate = new Date(scanTimestamp);
  const formattedDate = scanDate.toLocaleString();
  
  lastScanInfo.textContent = `Dernière analyse: ${formattedDate}`;
  lastScanInfo.style.display = 'block';
}

function updateResultsUI() {
  // Appliquer le filtrage, le tri et la recherche
  const filteredResults = filterResults();
  
  // Mettre à jour le résumé
  updateSummary(filteredResults);
  
  // Mettre à jour les onglets de résultats
  updateResultsTab(allResultsTab, filteredResults.all, 'Tous');
  updateResultsTab(linksResultsTab, filteredResults.links, 'Liens');
  updateResultsTab(imagesResultsTab, filteredResults.images, 'Images');
  
  // Activer le bouton d'exportation s'il y a des résultats
  exportResultsButton.disabled = filteredResults.all.length === 0;
}

function filterResults() {
  let filteredLinks = [...results.links];
  let filteredImages = [...results.images];
  
  // Filtrer par statut
  if (currentFilter !== 'all') {
    const statusFilters = {
      'error': ['error', 'clientError', 'serverError', 'invalid'],
      'warning': ['warning', 'redirect', 'skipped'],
      'success': ['success']
    };
    
    const allowedStatuses = statusFilters[currentFilter] || [];
    
    filteredLinks = filteredLinks.filter(item => allowedStatuses.includes(item.status));
    filteredImages = filteredImages.filter(item => allowedStatuses.includes(item.status));
  }
  
  // Filtrer par recherche
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (searchTerm) {
    filteredLinks = filteredLinks.filter(item => 
      (item.url && item.url.toLowerCase().includes(searchTerm)) ||
      (item.statusMessage && item.statusMessage.toLowerCase().includes(searchTerm)) ||
      (item.contentType && item.contentType.toLowerCase().includes(searchTerm))
    );
    
    filteredImages = filteredImages.filter(item => 
      (item.url && item.url.toLowerCase().includes(searchTerm)) ||
      (item.statusMessage && item.statusMessage.toLowerCase().includes(searchTerm)) ||
      (item.contentType && item.contentType.toLowerCase().includes(searchTerm))
    );
  }
  
  // Trier les résultats
  const sortFunction = getSortFunction(currentSort, currentSortDirection);
  filteredLinks.sort(sortFunction);
  filteredImages.sort(sortFunction);
  
  return {
    links: filteredLinks,
    images: filteredImages,
    all: [...filteredLinks, ...filteredImages]
  };
}

function getSortFunction(sort, direction) {
  const directionMultiplier = direction === 'asc' ? 1 : -1;
  
  return (a, b) => {
    let valueA, valueB;
    
    switch (sort) {
      case 'url':
        valueA = a.url || '';
        valueB = b.url || '';
        return directionMultiplier * valueA.localeCompare(valueB);
      
      case 'type':
        // Définir l'ordre des types: d'abord les erreurs, puis les avertissements, puis les succès
        const statusOrder = {
          'error': 0, 'clientError': 0, 'serverError': 0, 'invalid': 0,
          'warning': 1, 'redirect': 1, 'skipped': 1,
          'success': 2
        };
        
        const typeA = a.url && a.url.startsWith('data:image/') ? 'data-image' : 
                      a.isImage ? 'image' : 'link';
        const typeB = b.url && b.url.startsWith('data:image/') ? 'data-image' : 
                      b.isImage ? 'image' : 'link';
                      
        if (typeA === typeB) {
          // Si même type, trier par statut
          valueA = statusOrder[a.status] || 3;
          valueB = statusOrder[b.status] || 3;
        } else {
          // Sinon, trier par type
          valueA = typeA;
          valueB = typeB;
          return directionMultiplier * valueA.localeCompare(valueB);
        }
        break;
      
      case 'status':
      default:
        // Définir l'ordre des statuts
        const order = {
          'error': 0, 'clientError': 0, 'serverError': 0, 'invalid': 0,
          'warning': 1, 'redirect': 1, 'skipped': 1,
          'success': 2
        };
        
        valueA = order[a.status] || 3;
        valueB = order[b.status] || 3;
    }
    
    if (valueA === valueB) {
      // En cas d'égalité, trier par URL
      return a.url.localeCompare(b.url);
    }
    
    // Comparaison numérique pour les valeurs numériques
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return directionMultiplier * (valueA - valueB);
    }
    
    // Comparaison lexicographique pour les chaînes
    return directionMultiplier * String(valueA).localeCompare(String(valueB));
  };
}

function updateSummary(filteredResults) {
  const allResults = filteredResults.all;
  const totalItems = allResults.length;
  const successItems = allResults.filter(r => r.status === 'success').length;
  const warningItems = allResults.filter(r => ['redirect', 'warning', 'skipped'].includes(r.status)).length;
  const errorItems = allResults.filter(r => ['error', 'clientError', 'serverError', 'invalid'].includes(r.status)).length;
  
  totalCount.textContent = totalItems;
  successCount.textContent = successItems;
  warningCount.textContent = warningItems;
  errorCount.textContent = errorItems;
  
  // Afficher le résumé s'il y a des résultats
  summaryContainer.style.display = totalItems > 0 ? 'block' : 'none';
}

function updateResultsTab(tabElement, results, type) {
  if (results.length === 0) {
    tabElement.innerHTML = `<div class="no-results">Aucun ${type.toLowerCase()} vérifié${currentFilter !== 'all' || searchInput && searchInput.value ? ' correspondant aux critères' : ''}.</div>`;
    return;
  }
  
  // Générer le HTML
  let html = '';
  
  results.forEach(result => {
    // Déterminer le type de lien pour un meilleur affichage
    const linkType = determineLinkType(result);
    const mightBeValidDespiteError = checkIfMightBeValid(result);
    
    const statusClass = getStatusClass(result.status, linkType);
    const statusText = getStatusText(result.status, result.statusCode, linkType);
    
    // Déterminer l'icône appropriée
    const icon = getIconForLinkType(linkType);
    
    // Créer le badge de type pour les cas spéciaux
    const typeBadge = createTypeBadge(linkType);
    
    // Définir la classe CSS pour l'élément de résultat
    const itemClass = `result-item${mightBeValidDespiteError ? ' maybe-valid' : ''}`;
    
    // Ajouter des attributs data pour permettre l'interaction
    const dataAttributes = `
      data-url="${escapeHtml(result.url)}"
      data-status="${result.status}"
      data-type="${result.isImage ? 'image' : 'link'}"
      ${result.selector ? `data-selector="${escapeHtml(result.selector)}"` : ''}
    `;
    
    // Créer les boutons d'action
    const actionButtons = `
      <div class="result-actions">
        <button class="result-action-button open-button" title="Ouvrir dans un nouvel onglet">🔗</button>
        <button class="result-action-button copy-button" title="Copier l'URL">📋</button>
        ${result.selector ? `<button class="result-action-button highlight-button" title="Mettre en évidence sur la page">🔍</button>` : ''}
      </div>
    `;
    
    html += `
      <div class="${itemClass}" ${dataAttributes}>
        <div class="result-title">
          <div class="result-url-container">
            ${typeBadge}
            <div class="result-url" title="${escapeHtml(result.url)}">${icon} ${truncateUrl(result.url, 40)}</div>
          </div>
          <div class="result-info">
            <div class="result-status ${statusClass}">${statusText}</div>
            ${actionButtons}
          </div>
        </div>
        <div class="result-details">
          ${formatResultDetails(result, linkType)}
        </div>
      </div>
    `;
  });
  
  tabElement.innerHTML = html;
}

/**
 * Détermine le type de lien pour un meilleur affichage
 * @param {Object} result - Résultat de la vérification
 * @returns {string} - Type de lien
 */
function determineLinkType(result) {
  // Vérifier les protocoles spéciaux
  if (result.url.startsWith('mailto:')) return 'mailto';
  if (result.url.startsWith('tel:')) return 'tel';
  if (result.url.startsWith('javascript:')) return 'javascript';
  if (result.url.startsWith('#')) return 'fragment';
  if (result.isSpecialProtocol) return result.protocol || 'special';
  if (result.isFragment) return 'fragment';
  
  // Vérifier les domaines problématiques spécifiques
  if (result.url.includes('facebook.com') || result.url.includes('fb.com')) return 'facebook';
  if (result.url.includes('instagram.com')) return 'instagram';
  if (result.url.includes('linkedin.com')) return 'linkedin';
  if (result.url.includes('twitter.com') || result.url.includes('x.com')) return 'twitter';
  
  // Autres cas spéciaux
  if (result.isCorsBlocked) return 'cors';
  if (result.isProblematicDomain) return 'problematic';
  if (result.isImage) return 'image';
  if (result.isDataUrl) return 'data';
  
  // Cas par défaut
  return 'standard';
}

/**
 * Vérifie si un lien pourrait être valide malgré une erreur
 * @param {Object} result - Résultat de la vérification
 * @returns {boolean} - True si le lien pourrait être valide malgré une erreur
 */
function checkIfMightBeValid(result) {
  // Liens réseaux sociaux
  if ((['facebook', 'instagram', 'linkedin', 'twitter'].some(platform => 
        result.url.includes(`${platform}.com`))) && 
      ['invalid', 'error', 'clientError'].includes(result.status)) {
    return true;
  }
  
  // Autres domaines problématiques
  if (result.isProblematicDomain && ['invalid', 'error', 'clientError'].includes(result.status)) {
    return true;
  }
  
  // Problèmes CORS
  if (result.isCorsBlocked) {
    return true;
  }
  
  return false;
}

/**
 * Crée un badge de type pour les cas spéciaux
 * @param {string} type - Type de lien
 * @returns {string} - HTML du badge de type
 */
function createTypeBadge(type) {
  const badges = {
    'mailto': '<span class="result-type-badge type-mailto">Email</span>',
    'tel': '<span class="result-type-badge type-tel">Téléphone</span>',
    'javascript': '<span class="result-type-badge type-javascript">JavaScript</span>',
    'fragment': '<span class="result-type-badge type-fragment">Fragment</span>',
    'facebook': '<span class="result-type-badge type-facebook">Facebook</span>',
    'instagram': '<span class="result-type-badge type-instagram">Instagram</span>',
    'linkedin': '<span class="result-type-badge type-linkedin">LinkedIn</span>',
    'twitter': '<span class="result-type-badge type-twitter">Twitter</span>',
    'problematic': '<span class="result-type-badge type-problematic">Site protégé</span>',
    'cors': '<span class="result-type-badge type-cors">CORS</span>',
    'data': '<span class="result-type-badge type-data">Data URL</span>',
    'image': '<span class="result-type-badge type-image">Image</span>'
  };
  
  return badges[type] || '';
}

/**
 * Obtient l'icône appropriée pour un type de lien
 * @param {string} type - Type de lien
 * @returns {string} - Icône HTML
 */
function getIconForLinkType(type) {
  const icons = {
    'mailto': '✉️',
    'tel': '📞',
    'javascript': '📝',
    'fragment': '🔖',
    'facebook': '👤',
    'instagram': '📷',
    'linkedin': '💼',
    'twitter': '🐦',
    'problematic': '⚠️',
    'cors': '🚫',
    'image': '🖼️',
    'data': '📊',
    'standard': '🔗'
  };
  
  return icons[type] || icons['standard'];
}

/**
 * Obtient la classe CSS pour le statut
 * @param {string} status - Statut du lien
 * @param {string} linkType - Type de lien
 * @returns {string} - Classe CSS
 */
function getStatusClass(status, linkType) {
  // Pour les protocoles spéciaux, toujours montrer comme spécial
  if (['mailto', 'tel', 'javascript', 'fragment'].includes(linkType)) {
    return 'status-special';
  }
  
  if (status === 'success') return 'status-success';
  if (['redirect', 'warning', 'skipped'].includes(status)) return 'status-warning';
  return 'status-error';
}

/**
 * Obtient le texte de statut approprié
 * @param {string} status - Statut du lien
 * @param {number} statusCode - Code de statut HTTP
 * @param {string} linkType - Type de lien
 * @returns {string} - Texte de statut
 */
function getStatusText(status, statusCode, linkType) {
  // Pour les protocoles spéciaux
  if (linkType === 'mailto') return 'Email';
  if (linkType === 'tel') return 'Tél';
  if (linkType === 'javascript') return 'JS';
  if (linkType === 'fragment') return 'Fragment';
  if (linkType === 'data') return 'Data';
  
  // Pour les sites problématiques
  if (['facebook', 'instagram', 'linkedin', 'twitter'].includes(linkType) && 
      ['invalid', 'error'].includes(status)) {
    return linkType.charAt(0).toUpperCase() + linkType.slice(1);
  }
  
  if (linkType === 'cors') {
    return 'CORS';
  }
  
  // Statuts standards
  switch (status) {
    case 'success': return 'OK';
    case 'redirect': return 'Redirection';
    case 'warning': return 'Attention';
    case 'skipped': return 'Ignoré';
    case 'clientError': return `${statusCode || 'Erreur'}`;
    case 'serverError': return `${statusCode || 'Serveur'}`;
    case 'error': return 'Erreur';
    case 'invalid': return 'Invalide';
    default: return 'Inconnu';
  }
}

/**
 * Formate les détails du résultat
 * @param {Object} result - Résultat de la vérification
 * @param {string} linkType - Type de lien
 * @returns {string} - HTML des détails du résultat
 */
function formatResultDetails(result, linkType) {
  // Construire les détails
  let detailsHtml = '';
  
  // Pour les protocoles spéciaux
  if (linkType === 'mailto') {
    const email = result.url.replace('mailto:', '');
    detailsHtml += `<div><strong>Email:</strong> ${email}</div>`;
  } else if (linkType === 'tel') {
    const phone = result.url.replace('tel:', '');
    detailsHtml += `<div><strong>Téléphone:</strong> ${phone}</div>`;
  } else if (linkType === 'javascript') {
    detailsHtml += `<div><strong>Type:</strong> Script JavaScript</div>`;
  } else if (linkType === 'fragment') {
    const fragment = result.url.startsWith('#') ? result.url : `#${result.anchorName || ''}`;
    detailsHtml += `<div><strong>Fragment:</strong> ${fragment}</div>`;
    
    if (result.anchorChecked) {
      detailsHtml += `<div><strong>Ancre trouvée:</strong> ${result.anchorValid ? 'Oui' : 'Non'}</div>`;
    }
  } else {
    // Pour les liens et images standards
    
    // Status code et message
    if (result.statusCode) {
      detailsHtml += `<div><strong>Code HTTP:</strong> ${result.statusCode}</div>`;
    }
    
    if (result.statusMessage) {
      detailsHtml += `<div><strong>Message:</strong> ${result.statusMessage}</div>`;
    }
    
    // Type de contenu
    if (result.contentType) {
      detailsHtml += `<div><strong>Type de contenu:</strong> ${result.contentType}</div>`;
    }
    
    // URL finale en cas de redirection
    if (result.finalUrl && result.finalUrl !== result.url) {
      detailsHtml += `<div><strong>URL finale:</strong> ${truncateUrl(result.finalUrl, 50)}</div>`;
    }
    
    // Dimensions pour les images
    if (result.imageDimensions) {
      const { width, height } = result.imageDimensions;
      detailsHtml += `<div><strong>Dimensions:</strong> ${width}×${height} pixels</div>`;
    }
    
    // Taille du contenu
    if (result.contentLength) {
      const sizeInKB = Math.round(result.contentLength / 1024 * 100) / 100;
      detailsHtml += `<div><strong>Taille:</strong> ${sizeInKB} Ko</div>`;
    }
    
    // Timestamp
    if (result.timestamp) {
      const date = new Date(result.timestamp);
      detailsHtml += `<div><strong>Heure de vérification:</strong> ${date.toLocaleTimeString()}</div>`;
    }
    
    // Informations spéciales
    if (result.isCorsBlocked) {
      detailsHtml += `<div class="special-info cors-info">⚠️ <strong>Note:</strong> Blocage CORS détecté. L'élément peut s'afficher correctement pour les utilisateurs malgré cette restriction.</div>`;
    }
    
    if (result.isProblematicDomain) {
      detailsHtml += `<div class="special-info problematic-info">⚠️ <strong>Note:</strong> Site avec possible protection anti-scraping. Le lien peut fonctionner normalement pour les utilisateurs.</div>`;
    }
  }
  
  return detailsHtml;
}

/**
 * Met en évidence un élément sur la page active
 * @param {string} selector - Sélecteur CSS de l'élément
 * @param {string} status - Statut pour déterminer la couleur
 */
function highlightElementInPage(selector, status) {
  if (!selector) return;
  
  chrome.tabs.sendMessage(currentTabId, {
    action: 'highlightElement',
    selector: selector,
    status: status
  });
}

/**
 * Tronque une URL pour l'affichage
 * @param {string} url - URL à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - URL tronquée
 */
function truncateUrl(url, maxLength = 40) {
  if (!url) return '';
  
  // Pour les URLs de données, montrer seulement le début
  if (url.startsWith('data:')) {
    return url.substring(0, 18) + '...';
  }
  
  if (url.length <= maxLength) return url;
  
  // Tronquer au milieu
  const start = url.substring(0, Math.floor(maxLength / 2));
  const end = url.substring(url.length - Math.floor(maxLength / 2));
  return `${start}...${end}`;
}

/**
 * Définit l'onglet actif
 * @param {string} tabId - ID de l'onglet
 */
function setActiveTab(tabId) {
  // Mettre à jour les boutons d'onglet
  tabButtons.forEach(button => {
    if (button.id === `tab-${tabId}`) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  // Mettre à jour les contenus d'onglet
  resultsTabs.forEach(tab => {
    if (tab.id === `results-${tabId}`) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

/**
 * Sauvegarde la position de défilement actuelle
 */
function saveScrollPosition() {
  const activeTab = document.querySelector('.results-tab.active');
  if (activeTab) {
    lastScrollPosition = activeTab.scrollTop;
  }
}

/**
 * Restaure la position de défilement précédente
 */
function restoreScrollPosition() {
  const activeTab = document.querySelector('.results-tab.active');
  if (activeTab && lastScrollPosition) {
    setTimeout(() => {
      activeTab.scrollTop = lastScrollPosition;
    }, 0);
  }
}
// Fonction pour gérer le toggle de thème
function setupThemeToggle() {
  const lightThemeBtn = document.getElementById('light-theme');
  const darkThemeBtn = document.getElementById('dark-theme');
  
  if (!lightThemeBtn || !darkThemeBtn) return;
  
  // Vérifier le thème actuel
  function setActiveTheme(theme) {
    // Mettre à jour l'attribut data-theme
    document.documentElement.setAttribute('data-theme', theme);
    
    // Mettre à jour l'UI
    if (theme === 'dark') {
      lightThemeBtn.classList.remove('active');
      darkThemeBtn.classList.add('active');
    } else {
      lightThemeBtn.classList.add('active');
      darkThemeBtn.classList.remove('active');
    }
    
    // Sauvegarder la préférence
    chrome.storage.local.set({ theme: theme });
  }
  
  // Initialiser en fonction des préférences sauvegardées
  chrome.storage.local.get(['theme'], (data) => {
    if (data.theme) {
      setActiveTheme(data.theme);
    } else {
      // Par défaut, utiliser la préférence système
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setActiveTheme(prefersDark ? 'dark' : 'light');
    }
  });
  
  // Écouter les clics sur les boutons
  lightThemeBtn.addEventListener('click', () => setActiveTheme('light'));
  darkThemeBtn.addEventListener('click', () => setActiveTheme('dark'));
  
  // Écouter les changements de préférence système
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    chrome.storage.local.get(['theme'], (data) => {
      // Ne réagir que si aucune préférence explicite n'est définie
      if (!data.theme) {
        setActiveTheme(e.matches ? 'dark' : 'light');
      }
    });
  });
}