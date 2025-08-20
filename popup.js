/* popup.js */
document.addEventListener('DOMContentLoaded', async () => {
    const createLinkBtn = document.getElementById('createLinkBtn');
    const resultDiv = document.getElementById('result');
    const linkOutput = document.getElementById('linkOutput');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    const tabListContainer = document.getElementById('tabList');

    // --- NEW: Function to load and display tabs ---
    async function loadTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const filteredTabs = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));

        filteredTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab-item';
            
            // Store tab data directly on the element for easy access later
            tabElement.dataset.title = tab.title;
            tabElement.dataset.url = tab.url;
            tabElement.dataset.favIconUrl = tab.favIconUrl || '';

            const fallbackIcon = '[https://placehold.co/16x16/f1f5f9/64748b?text=L](https://placehold.co/16x16/f1f5f9/64748b?text=L)';

            tabElement.innerHTML = `
                <input type="checkbox" id="tab-${tab.id}" class="tab-checkbox" checked>
                <img src="${tab.favIconUrl || fallbackIcon}" class="favicon" onerror="this.onerror=null;this.src='${fallbackIcon}';">
                <label for="tab-${tab.id}">${tab.title}</label>
            `;
            tabListContainer.appendChild(tabElement);
        });
    }

    // Load tabs as soon as the popup opens
    loadTabs();

    // --- UPDATED: Event listener for the create button ---
    createLinkBtn.addEventListener('click', () => {
        const selectedTabsData = [];
        const checkedBoxes = document.querySelectorAll('.tab-checkbox:checked');

        // 1. Get data only from the checked tabs.
        checkedBoxes.forEach(checkbox => {
            const parent = checkbox.closest('.tab-item');
            if (parent) {
                selectedTabsData.push({
                    title: parent.dataset.title,
                    url: parent.dataset.url,
                    favIconUrl: parent.dataset.favIconUrl
                });
            }
        });

        if (selectedTabsData.length === 0) {
            // Optional: handle case where no tabs are selected
            alert("Please select at least one tab to create a LinkLeaf.");
            return;
        }

        // 2. Convert the selected tab data to a JSON string.
        const jsonString = JSON.stringify(selectedTabsData);

        // 3. Encode the JSON string into Base64 to make it URL-safe.
        const encodedData = btoa(jsonString);

        // 4. Get the URL for our local viewer.html file.
        const viewerUrl = chrome.runtime.getURL('viewer.html');

        // 5. Construct the final, shareable URL.
        const finalUrl = `${viewerUrl}#${encodedData}`;

        // 6. Display the result to the user.
        linkOutput.value = finalUrl;
        resultDiv.classList.remove('hidden');
    });

    copyBtn.addEventListener('click', () => {
        linkOutput.select();
        document.execCommand('copy');

        // Visual feedback for the user
        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
        setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
        }, 2000);
    });
});