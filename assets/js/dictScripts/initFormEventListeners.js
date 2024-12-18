import {
    getTranslatedText
} from './loadTexts.js';
import {
    processAllSettings
} from './processRows.js';
import {
    boxClickListener
} from './boxEvents.js';
import {
    highlight 
} from './utils.js';
import {
    initUrl
} from './urlParameters.js';

export const defaultPendingChanges = {
    searchTerm: '',
    exactMatch: false,
    searchIn: {
        word: true,
        root: true,
        definition: true,
        etymology: false
    },
    filters: [],
    rowsPerPage: 20,
    sortOrder: 'titleup' // Default sort order
};

export let universalPendingChanges;

export async function updatePendingChangesList(pendingChanges, language){

    if (!pendingChanges || pendingChanges.length === 0) {
        if (!universalPendingChanges || universalPendingChanges.length === 0) {
            universalPendingChanges = defaultPendingChanges;
        }
        pendingChanges = universalPendingChanges;
    }

    console.log('Pending Changes: ', pendingChanges);
    console.log('Universal PendingChanges: ', universalPendingChanges);
    
    const pendingChangesElement = document.getElementById('dict-pending-changes');
    if (!pendingChangesElement) return;
    const {
        searchTerm,
        exactMatch,
        searchIn,
        filters,
        ignoreDiacritics,
        startsWith,
        endsWith,
        rowsPerPage
    } = pendingChanges;
    let changesList = [];
    if (searchTerm) {
        const translatedSearchTerm = await getTranslatedText('searchTerm', language);
        changesList.push(`<strong>${translatedSearchTerm}</strong>: "${searchTerm}"`);
    }
    if (exactMatch) {
        const translatedExactMatch = await getTranslatedText('exactMatch', language);
        changesList.push(`<strong>${translatedExactMatch}</strong>: ${translatedExactMatch}`);
    }
    if (searchIn.word || searchIn.root || searchIn.definition || searchIn.etymology) {
        let searchInFields = [];
        if (searchIn.word) searchInFields.push(await getTranslatedText('searchInWord', language));
        if (searchIn.root) searchInFields.push(await getTranslatedText('searchInRoot', language));
        if (searchIn.definition) searchInFields.push(await getTranslatedText('searchInDefinition', language));
        if (searchIn.etymology) searchInFields.push(await getTranslatedText('searchInEtymology', language));
        const translatedSearchIn = await getTranslatedText('searchIn', language);
        changesList.push(`<strong>${translatedSearchIn}</strong>: ${searchInFields.join(', ')}`);
    }
    if (ignoreDiacritics) {
        const translatedIgnoreDiacritics = await getTranslatedText('ignoreDiacritics', language);
        changesList.push(`<strong>${translatedIgnoreDiacritics}</strong>`);
    }
    if (startsWith) {
        const translatedStartsWith = await getTranslatedText('startsWith', language);
        changesList.push(`<strong>${translatedStartsWith}</strong>`);
    }
    if (endsWith) {
        const translatedEndsWith = await getTranslatedText('endsWith', language);
        changesList.push(`<strong>${translatedEndsWith}</strong>`);
    }
    if (filters.length > 0) {
        const translatedFilters = await getTranslatedText('filters', language);
        const translatedFilterValues = await Promise.all(filters.map(async filter => await getTranslatedText(filter, language)));
        changesList.push(`<strong>${translatedFilters}</strong>: ${translatedFilterValues.join(', ')}`);
    }
    if (rowsPerPage !== 20) {
        const translatedRowsPerPage = await getTranslatedText('rowsPerPage', language);
        changesList.push(`<strong>${translatedRowsPerPage}</strong>: ${rowsPerPage}`);
    }
    const translatedPendingChanges = await getTranslatedText('pendingChanges', language);
    const translatedNoPendingChanges = await getTranslatedText('noPendingChanges', language);
    
    universalPendingChanges = pendingChanges; 
    
    pendingChangesElement.innerHTML = changesList.length > 0 ? `<ul>${changesList.map(item => `<li>${item}</li>`).join('')}</ul>` : `<p>${translatedNoPendingChanges}</p>`;
}

export function initializeFormEventListeners(allRows, pendingChanges, rowsPerPage, displayPage) {
    console.log('Initializing Form Event Listeners');

    initUrl(allRows, rowsPerPage, displayPage, 1, 'titleup');
    
    if (!pendingChanges || pendingChanges.length === 0) {
        if (!universalPendingChanges || universalPendingChanges.length === 0) {
            universalPendingChanges = defaultPendingChanges;
        }
        pendingChanges = universalPendingChanges;
    }

    console.log('Pending Changes I: ', pendingChanges);
    console.log('Universal PendingChanges I: ', universalPendingChanges);

    const language = document.querySelector('meta[name="language"]').content || 'en';
    const filterSelect = document.getElementById('dict-word-filter');
    let currentPage = 1;

    if (filterSelect) {
        filterSelect.addEventListener('change', async () => {
            pendingChanges.filters = Array.from(filterSelect.selectedOptions).map(option => option.value);
            updatePendingChangesList(pendingChanges, language);
            universalPendingChanges = pendingChanges;
            currentPage = 1;
            await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
        });
    }

    const searchInput = document.getElementById('dict-search-input');
    const predictionBox = document.getElementById('dict-search-predictions');

    searchInput.addEventListener('input', async function() {
        const searchTerm = this.value.trim().toLowerCase();
        predictionBox.style.width = `${searchInput.offsetWidth}px`;

        if (searchTerm.length === 0) {
            predictionBox.innerHTML = '';
            pendingChanges.searchTerm = ''; // Clear searchTerm in pending changes
            updatePendingChangesList(pendingChanges, language); // Update pending changes list
            universalPendingChanges = pendingChanges;
            currentPage = 1;
            await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
            return;
        }

        const searchIn = pendingChanges.searchIn;
        const predictions = allRows
            .filter(row => {
                const titleMatch = searchIn.word && row.type === 'word' && row.title.toLowerCase().includes(searchTerm);
                const rootMatch = searchIn.root && row.type === 'root' && row.title.toLowerCase().includes(searchTerm);
                const definitionMatch = searchIn.definition && row.meta.toLowerCase().includes(searchTerm);
                const etymologyMatch = searchIn.etymology && row.morph.some(morphItem => morphItem.toLowerCase().includes(searchTerm));
                return titleMatch || rootMatch || definitionMatch || etymologyMatch;
            })
            .slice(0, 10) // Limit to the first 10 matches
            .map(row => ({ title: row.title, meta: row.meta }));

        if (predictions.length === 0) {
            predictionBox.innerHTML = '';
            pendingChanges.searchTerm = searchTerm; // Update searchTerm in pending changes
            updatePendingChangesList(pendingChanges, language); // Update pending changes list
            universalPendingChanges = pendingChanges;
            currentPage = 1;
            await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
            return;
        }

        predictionBox.innerHTML = predictions.map(({ title, meta }) => 
            `<div>${highlight(title, searchTerm, pendingChanges.searchIn, { title })} (${meta})</div>`
        ).join('');

        Array.from(predictionBox.children).forEach((prediction, index) => {
            prediction.addEventListener('click', async () => {
                searchInput.value = predictions[index].title;
                predictionBox.innerHTML = '';
                pendingChanges.searchTerm = predictions[index].title; // Update searchTerm in pending changes
                updatePendingChangesList(pendingChanges, language); // Update pending changes list
                universalPendingChanges = pendingChanges;
                currentPage = 1;
                await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
            });
        });

        pendingChanges.searchTerm = searchTerm;
        updatePendingChangesList(pendingChanges, language);
        universalPendingChanges = pendingChanges;
        currentPage = 1;
        await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
    });

    document.addEventListener('focusin', (e) => {
        if (!searchInput.contains(e.target) && !predictionBox.contains(e.target)) {
            predictionBox.innerHTML = '';
        }
    });

    searchInput.addEventListener('focus', async () => {
        if (searchInput.value.trim().length > 0) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });

    const rowsPerPageSelect = document.getElementById('dict-rows-per-page-input');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', async () => {
            pendingChanges.rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
            updatePendingChangesList(pendingChanges, language);
            universalPendingChanges = pendingChanges;
            currentPage = 1;
            await processAllSettings(pendingChanges, allRows, rowsPerPage, currentPage, pendingChanges.sortOrder);
        });
    }

    console.log('Form Event Listeners initialized');
}

export function updateUniversalPendingChanges(i) {

   universalPendingChanges = i;
    
} 
