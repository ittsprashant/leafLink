/* viewer.js */
document.addEventListener('DOMContentLoaded', () => {
    const linkList = document.getElementById('linkList');
    const linkCount = document.getElementById('linkCount');

    // 1. Get the encoded data from the URL hash.
    const encodedData = window.location.hash.substring(1);

    if (!encodedData) {
        linkCount.textContent = "No links found in this Leaf.";
        return;
    }

    try {
        // 2. Decode the Base64 string back to a JSON string.
        const jsonString = atob(encodedData);

        // 3. Parse the JSON string into an array of objects.
        const tabData = JSON.parse(jsonString);

        linkCount.textContent = `${tabData.length} tabs bundled in this Leaf.`;

        // 4. Loop through the data and create the HTML for each link.
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
        console.error("Error decoding or parsing tab data:", error);
        linkCount.textContent = "Could not load the links in this Leaf. The data may be corrupted.";
    }
});