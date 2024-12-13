import { processAllSettings } from './processRows.js';
import { getRelatedWordsByRoot, highlight, createHyperlink } from './utils.js';
import { updatePagination } from './pagination.js';
import { getTranslatedText } from './loadTexts.js';
import { initAdvancedSearchPopup, initStatisticsPopup } from './popups.js';

export function initializeEventListeners(allRows, rowsPerPage, currentSortOrder, pendingChanges, displayPage) {
    let currentPage = 1;
    let previouslySelectedBox = null;
    let lastClickTime = 0;

    // Ensure pendingChanges list is visible on page load
    const pendingChangesElement = document.getElementById('dict-pending-changes');
    if (pendingChangesElement) {
        pendingChangesElement.style.display = 'block';
    }

    /**
 * Updates the pending changes display.
 */
async function updatePendingChangesList(language) {
    const pendingChangesElement = document.getElementById('dict-pending-changes');
    if (!pendingChangesElement) return;

    const changes = [];

    if (pendingChanges.searchTerm) {
        const translatedSearchTerm = await getTranslatedText('searchTerm', language);
        changes.push(`<strong>${translatedSearchTerm}</strong>: ${pendingChanges.searchTerm}`);
    }
    
    if (pendingChanges.exactMatch) {
        const translatedExactMatch = await getTranslatedText('exactMatch', language);
        changes.push(`<strong>${translatedExactMatch}</strong>`);
    }

    if (pendingChanges.filters.length) {
        const translatedFilters = await getTranslatedText('filters', language);
        changes.push(`<strong>${translatedFilters}</strong>: ${pendingChanges.filters.join(', ')}`);
    }

    if (pendingChanges.sortOrder) {
        const translatedSortOrder = await getTranslatedText('sortOrder', language);
        const sortOrderText = document.querySelector(`#dict-order-by-select option[value="${pendingChanges.sortOrder}"]`).textContent;
        changes.push(`<strong>${translatedSortOrder}</strong>: ${sortOrderText}`);
    }

    if (pendingChanges.rowsPerPage) {
        const translatedRowsPerPage = await getTranslatedText('rowsPerPage', language);
        changes.push(`<strong>${translatedRowsPerPage}</strong>: ${pendingChanges.rowsPerPage}`);
    }

    const translatedPendingChanges = await getTranslatedText('pendingChanges', language);
    const translatedNoPendingChanges = await getTranslatedText('noPendingChanges', language);
    pendingChangesElement.innerHTML = changes.length ? `<p><strong>${translatedPendingChanges}</strong></p><p>${changes.join('</p><p>')}</p>` : `<p>${translatedNoPendingChanges}</p>`;
}

    updatePendingChangesList();

    const orderBySelect = document.getElementById('dict-order-by-select');
    if (orderBySelect) {
        orderBySelect.addEventListener('change', () => {
            pendingChanges.sortOrder = orderBySelect.value;
            updatePendingChangesList();
        });
    }

    const toggleFilterButton = document.getElementById('dict-toggle-filter-button');
    if (toggleFilterButton) {
        toggleFilterButton.addEventListener('click', () => {
            const filterSortingContainer = document.getElementById('dict-filter-sorting-container');
            filterSortingContainer.classList.toggle('dict-filter-cont-hidden');
            filterSortingContainer.classList.toggle('dict-filter-cont-visible');
        });
    }

    const advancedSearchButton = document.getElementById('dict-advanced-search-button');
    if (advancedSearchButton) {
        advancedSearchButton.addEventListener('click', () => {
            initAdvancedSearchPopup(allRows, rowsPerPage, displayPage, pendingChanges);
        });
    }

    const viewStatisticsButton = document.getElementById('dict-view-statistics-button');
    if (viewStatisticsButton) {
        viewStatisticsButton.addEventListener('click', () => {
            initStatisticsPopup(allRows);
        });
    }

    const applySettingsButton = document.getElementById('dict-apply-settings-button');
    if (applySettingsButton) {
        applySettingsButton.addEventListener('click', () => {
            processAllSettings(pendingChanges, allRows, rowsPerPage, displayPage, currentPage, pendingChanges.sortOrder);
        });
    }

    const cleanSettingsButton = document.getElementById('dict-clear-settings-button');
    if (cleanSettingsButton) {
        cleanSettingsButton.addEventListener('click', () => {
            pendingChanges = {
                searchTerm: '',
                exactMatch: false,
                searchIn: { word: true, root: true, definition: false, etymology: false },
                filters: [],
                rowsPerPage: 20
            };
            updatePendingChangesList();
            processAllSettings(pendingChanges, allRows, rowsPerPage, displayPage, currentPage, pendingChanges.sortOrder);
            // Remove URL parameters without reloading the page
            history.pushState({}, document.title, window.location.pathname);
        });
    }

    const cleanSearchButton = document.getElementById('dict-clear-search-button');
    if (cleanSearchButton) {
        cleanSearchButton.addEventListener('click', () => {
            pendingChanges.searchTerm = '';
            document.getElementById('dict-search-input').value = '';
            updatePendingChangesList();
            processAllSettings(pendingChanges, allRows, rowsPerPage, displayPage, currentPage, pendingChanges.sortOrder);
            // Remove URL parameters without reloading the page
            history.pushState({}, document.title, window.location.pathname);
        });
    }

    const searchInput = document.getElementById('dict-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            pendingChanges.searchTerm = e.target.value;
            updatePendingChangesList();
        });
    }

    const rowsPerPageSelect = document.getElementById('dict-rows-per-page-input');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', () => {
            pendingChanges.rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
            updatePendingChangesList();
        });
    }

async function handleClickEvent(e) {
    const now = Date.now();
    if (now - lastClickTime < 250) return; // 0.25 second cooldown
    lastClickTime = now;

    const target = e.target;
    if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('.icon-container')) {
        // Ignore clicks on links, buttons, and the icon container
        return;
    }

    e.stopPropagation(); // Stop event propagation to avoid duplicate events
    e.preventDefault();  // Prevent default action to ensure correct handling

    // Find the closest .dictionary-box element
    const box = target.closest('.dictionary-box');
    if (!box) return;

    // Extract the type and row ID from the box's ID attribute
    const [type, id] = box.id.split('-');
    const rowId = parseInt(id, 10);
    const row = allRows.find(r => r.id === rowId && r.type === type);

    if (!row) {
        console.error(`Row with id ${rowId} and type ${type} not found.`);
        return;
    }

    if (previouslySelectedBox) {
        previouslySelectedBox.classList.remove('selected-word', 'selected-root');
        const previousRelatedWords = previouslySelectedBox.querySelector('.related-words');
        if (previousRelatedWords) {
            previouslySelectedBox.removeChild(previousRelatedWords);
        }
    }

    if (box === previouslySelectedBox) {
        previouslySelectedBox = null;
        return;
    }

    box.classList.add(row.type === 'root' ? 'selected-root' : 'selected-word');

    const relatedWordsElement = document.createElement('div');
    relatedWordsElement.className = 'related-words';
    relatedWordsElement.style.fontSize = '0.85em';

    const language = document.querySelector('meta[name="language"]').content || 'en';

    let derivativeWordsLabel = '';
    let relatedWordsLabel = '';

    if (row.type === 'root') {
        derivativeWordsLabel = await getTranslatedText('derivativeWords', language);
        if (row.related && row.related.length > 0) {
            console.log('Derivatives:', row.related); // Debugging

            // Ensure the displayed word is not shown as a related word
            const relatedWordsHtml = row.related
                .filter(dw => dw.toLowerCase() !== row.title.toLowerCase())
                .map(dw => {
                    // Find the related word in the allRows array
                    const relatedWord = typeof dw === 'string' ? allRows.find(r => r.title.trim().toLowerCase() === dw.trim().toLowerCase()) : dw;

                    // Log for debugging
                    console.log('Derivative word:', dw, 'Related word:', relatedWord);

                    // Return a string with the title and ID, formatted with a hyperlink
                    return relatedWord ? `${relatedWord.title} [${relatedWord.id}]: ${createHyperlink(relatedWord.title, pendingChanges.searchTerm, allRows)}` : dw;
                }).join(', ');

            relatedWordsElement.innerHTML = `<strong>${derivativeWordsLabel}:</strong> ${relatedWordsHtml}`;
        } else {
            relatedWordsElement.innerHTML = `<strong>${derivativeWordsLabel}:</strong> ${await getTranslatedText('noneFound', language)}`;
        }

        // Ensure `morph` exists and has more than one element
        if (row.morph && row.morph.length > 1) {
            console.log('Morph length is greater than 1:', row.morph); // Debugging
            const rootButtonsElement = document.createElement('div');
            rootButtonsElement.className = 'root-buttons';
            for (const root of row.morph) {
                console.log('Creating button for root:', root); // Debugging
                const rootButton = document.createElement('button');
                rootButton.innerText = root;
                rootButton.addEventListener('click', async () => {
                    console.log('Clicked root button:', root); // Debugging
                    const rootRelatedWords = allRows.filter(r => r.root === root && r.title.toLowerCase() !== row.title.toLowerCase())
                        .map(r => `${r.title} [${r.id}]: ${createHyperlink(r.title, pendingChanges.searchTerm, allRows)}`)
                        .join(', ');

                    relatedWordsLabel = await getTranslatedText('relatedWords', language);
                    relatedWordsElement.innerHTML = `<strong>${relatedWordsLabel}:</strong> ${rootRelatedWords}`;
                });
                rootButtonsElement.appendChild(rootButton);
            }
            relatedWordsElement.appendChild(rootButtonsElement);
        }
    } else {
        relatedWordsLabel = await getTranslatedText('relatedWords', language);
        const relatedWords = row.related || [];

        if (relatedWords.length > 0) {
            console.log('Related Words:', relatedWords); // Debugging
            const relatedWordsHtml = relatedWords
                .filter(rw => rw.toLowerCase() !== row.title.toLowerCase())
                .map(rw => {
                    const relatedWord = typeof rw === 'string' ? allRows.find(r => r.title.trim().toLowerCase() === rw.trim().toLowerCase()) : rw;
                    console.log('Related word:', rw, 'Related word:', relatedWord);
                    return relatedWord ? `${relatedWord.title} [${relatedWord.id}]: ${createHyperlink(relatedWord.title, pendingChanges.searchTerm, allRows)}` : rw;
                }).join(', ');

            relatedWordsElement.innerHTML = `<strong>${relatedWordsLabel}:</strong> ${relatedWordsHtml}`;
        } else {
            relatedWordsElement.innerHTML = `<strong>${relatedWordsLabel}:</strong> ${await getTranslatedText('noneFound', language)}`;
        }
    }

    if (relatedWordsElement.scrollHeight > 3 * parseFloat(getComputedStyle(relatedWordsElement).lineHeight)) {
        relatedWordsElement.style.maxHeight = '3em';
        relatedWordsElement.style.overflowY = 'auto';
    }

    box.appendChild(relatedWordsElement);

    previouslySelectedBox = box;
}

    const dictionaryContainer = document.getElementById('dict-dictionary');
    dictionaryContainer.addEventListener('click', handleClickEvent, true); // Use capturing phase

    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetPage = parseInt(e.target.dataset.page, 10);
            if (!isNaN(targetPage)) {
                navigateToPage(targetPage);
            }
        });
    });

    function navigateToPage(pageNumber) {
        if (!isNaN(pageNumber) && pageNumber >= 1) {
            currentPage = pageNumber;
        } else {
            currentPage = 1;
        }

        const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
        updatePagination(currentPage, totalPages);
        displayPage(currentPage, rowsPerPage, pendingChanges.searchTerm, pendingChanges.searchIn, pendingChanges.exactMatch, filteredRows, allRows);
    }

    navigateToPage(1);
} 
