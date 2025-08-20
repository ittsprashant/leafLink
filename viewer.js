/* viewer.js */
document.addEventListener('DOMContentLoaded', () => {
    // --- UPDATED: Get the new title element ---
    const pageTitle = document.getElementById('pageTitle');
    const linkList = document.getElementById('linkList');
    const linkCount = document.getElementById('linkCount');

    const encodedData = window.location.hash.substring(1);

    if (!encodedData) {
        linkCount.textContent = "No links found in this Leaf.";
        return;
    }

    try {
        const jsonString = atob(encodedData);
        // --- UPDATED: Parse the parent object ---
        const data = JSON.parse(jsonString);
        
        const pageTitleText = data.title || "Your LinkLeaf";
        const tabData = data.tabs || [];

        // --- NEW: Set the page title ---
        pageTitle.textContent = pageTitleText;
        document.title = pageTitleText; // Also set the browser tab title

        linkCount.textContent = `${tabData.length} tabs bundled in this Leaf.`;

        tabData.forEach(tab => {
            const listItem = document.createElement('li');
            const fallbackIcon = '[https://placehold.co/20x20/f1f5f9/64748b?text=L](https://placehold.co/20x20/f1f5f9/64748b?text=L)';

            listItem.innerHTML = `
                <a href="${tab.url}" target="_blank" rel="noopener noreferrer">
                    <img src="${tab.favIconUrl || fallbackIcon}" class="favicon" onerror="this.onerror=null;this.src='${fallbackIcon}';">
                    <div class="link-content">
                        <span class="title">${tab.title}</span>
                        <span class="url">${tab.url}</span>
                    </div>
                </a>
            `;
            linkList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error decoding or parsing data:", error);
        linkCount.textContent = "Could not load the links in this Leaf. The data may be corrupted.";
    }
});
