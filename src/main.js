import './style.css'

async function fetchDataFromAPIEndPoint(){
  try {
    const cards = await fetch('/api/fetchNotion')
      .then((res) => res.json())
      .then((data) => data.results);
    
    console.log(cards);
    
    const cardContainer = document.querySelector('#app');
    if (cardContainer && cards && cards.length > 0) {
      cardContainer.innerHTML = cards.map((card) => {
        const imageUrl = card.properties.titleImage?.files?.[0]?.external?.url || '';
        const title = card.properties.Name?.title?.[0]?.plain_text || 'Untitled';
        const description = card.properties.description?.rich_text?.[0]?.plain_text || 'No description available';
        const tags = card.properties.tag?.multi_select || [];
        const type = card.properties.type?.select?.name || "Project";
        const slug = card.properties.slug?.rich_text?.[0]?.plain_text || card.id;
        
        // Generate tag HTML
        const tagHTML = tags.length > 0 
          ? tags.map(tag => `<span class="tag">${tag.name}</span>`).join('')
          : '<span class="tag">Project</span>';
        
        return `
          <article class="card">
            <a href="/generated/${slug}.html" class="card__link">
              <div class="card__image-wrapper">
                <img src="${imageUrl}" 
                     alt="${title}" class="card__image">
                <div class="card__overlay">
                  <span class="card__category">${type}</span>
                </div>
              </div>
              <div class="card__content">
                <h3 class="card__title">${title}</h3>
                <p class="card__description">${description}</p>
                <div class="card__tags">
                  ${tagHTML}
                </div>
              </div>
            </a>
          </article>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    const cardContainer = document.querySelector('#app');
    if (cardContainer) {
      cardContainer.innerHTML = '<p>Unable to load projects at this time.</p>';
    }
  }
}

// Add smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', () => {
  // Fetch data
  fetchDataFromAPIEndPoint();
  
  // Add scroll effect to navigation
  const nav = document.querySelector('.nav');
  let lastScrollY = window.scrollY;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
      nav.style.transform = 'translateY(-100%)';
    } else {
      nav.style.transform = 'translateY(0)';
    }
    lastScrollY = window.scrollY;
  });
});
