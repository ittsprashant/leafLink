/* popup.js */
document.addEventListener('DOMContentLoaded', async () => {
    const linkleafTitleInput = document.getElementById('linkleafTitle');
    // --- UPDATED: Get the new checkbox instead of buttons ---
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const createLinkBtn = document.getElementById('createLinkBtn');
    const resultDiv = document.getElementById('result');
    const linkOutput = document.getElementById('linkOutput');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    const tabListContainer = document.getElementById('tabList');
    const createBtnText = document.getElementById('createBtnText');
    const createIcon = document.getElementById('createIcon');
    const copiedIcon = document.getElementById('copiedIcon');

    // --- NEW: Function to update the main checkbox based on children ---
    function updateSelectAllCheckboxState() {
        const allTabCheckboxes = document.querySelectorAll('.tab-checkbox');
        // Check if every single tab checkbox is checked
        const allChecked = [...allTabCheckboxes].every(checkbox => checkbox.checked);
        selectAllCheckbox.checked = allChecked;
    }

    async function loadTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const filteredTabs = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://'));

        filteredTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab-item';
            
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
        // After loading, ensure the "Select All" checkbox is correctly set (it should be checked)
        updateSelectAllCheckboxState();
    }

    loadTabs();

    // --- NEW: Event listener for the main "Select All" checkbox ---
    selectAllCheckbox.addEventListener('change', () => {
        const isChecked = selectAllCheckbox.checked;
        document.querySelectorAll('.tab-checkbox').forEach(checkbox => checkbox.checked = isChecked);
    });

    // --- NEW: Delegated event listener for individual tab checkboxes ---
    tabListContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('tab-checkbox')) {
            updateSelectAllCheckboxState();
        }
    });

    createLinkBtn.addEventListener('click', () => {
        const selectedTabsData = [];
        const checkedBoxes = document.querySelectorAll('.tab-checkbox:checked');
        const title = linkleafTitleInput.value.trim() || "My LinkLeaf";

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
            alert("Please select at least one tab.");
            return;
        }

        const dataToEncode = { title: title, tabs: selectedTabsData };
        const jsonString = JSON.stringify(dataToEncode);
        const encodedData = btoa(jsonString);
        // const viewerUrl = chrome.runtime.getURL('viewer.html');
        const viewerUrl = `https://linkleaf.netlify.app/`;
        const finalUrl = `${viewerUrl}#${encodedData}`;

        linkOutput.value = finalUrl;
        resultDiv.classList.remove('hidden');

        linkOutput.select();
        document.execCommand('copy');
        
        createBtnText.textContent = "Copied!";
        createIcon.classList.add('hidden');
        copiedIcon.classList.remove('hidden');
        createLinkBtn.classList.add('copied');

        setTimeout(() => {
            createBtnText.textContent = "Create & Copy Link";
            createIcon.classList.remove('hidden');
            copiedIcon.classList.add('hidden');
            createLinkBtn.classList.remove('copied');
        }, 2000);

        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
    });

    copyBtn.addEventListener('click', () => {
        linkOutput.select();
        document.execCommand('copy');
        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
        setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
        }, 2000);
    });
});