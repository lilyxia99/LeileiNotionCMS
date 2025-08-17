import './style.css'

let allCards = []; // Store all cards for filtering
let activeFilters = new Set(); // Store active filter tags

async function fetchTagOptions() {
  try {
    const response = await fetch('/api/getTagOptions');
    const data = await response.json();
    return data.tagOptions || [];
  } catch (error) {
    console.error('Error fetching tag options:', error);
    return [];
  }
}

function setupFilterUI(tagOptions) {
  const filterTags = document.getElementById('filterTags');
  const filterToggle = document.getElementById('filterToggle');
  const filterOptions = document.getElementById('filterOptions');
  
  if (!filterTags || !filterToggle || !filterOptions) return;
  
  // Add "Show All" option
  const showAllTag = document.createElement('span');
  showAllTag.className = 'filter-tag show-all active';
  showAllTag.textContent = 'Show All';
  showAllTag.addEventListener('click', () => {
    activeFilters.clear();
    updateFilterUI();
    filterCards();
  });
  filterTags.appendChild(showAllTag);
  
  // Add tag filter options
  tagOptions.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'filter-tag';
    tagElement.textContent = tag.name;
    tagElement.addEventListener('click', () => {
      if (activeFilters.has(tag.name)) {
        activeFilters.delete(tag.name);
      } else {
        activeFilters.add(tag.name);
      }
      updateFilterUI();
      filterCards();
    });
    filterTags.appendChild(tagElement);
  });
  
  // Toggle filter visibility
  filterToggle.addEventListener('click', () => {
    const isOpen = filterOptions.classList.contains('show');
    if (isOpen) {
      filterOptions.classList.remove('show');
      filterToggle.classList.remove('active');
    } else {
      filterOptions.classList.add('show');
      filterToggle.classList.add('active');
    }
  });
}

function updateFilterUI() {
  const filterTags = document.querySelectorAll('.filter-tag');
  filterTags.forEach(tag => {
    if (tag.classList.contains('show-all')) {
      tag.classList.toggle('active', activeFilters.size === 0);
    } else {
      tag.classList.toggle('active', activeFilters.has(tag.textContent));
    }
  });
}

function filterCards() {
  const cardContainer = document.querySelector('#app');
  if (!cardContainer || !allCards.length) return;
  
  let filteredCards = allCards;
  
  // If filters are active, filter the cards
  if (activeFilters.size > 0) {
    filteredCards = allCards.filter(card => {
      const cardTags = card.properties.tag?.multi_select || [];
      return cardTags.some(tag => activeFilters.has(tag.name));
    });
  }
  
  // Re-render filtered cards
  renderCards(filteredCards);
}

function renderCards(cards) {
  const cardContainer = document.querySelector('#app');
  if (!cardContainer) return;
  
  if (cards.length === 0) {
    cardContainer.innerHTML = '<p class="section__subtitle">No projects match the selected filters.</p>';
    return;
  }
  
  cardContainer.innerHTML = cards.map((card) => {
    const imageUrl = card.properties.titleImage?.files?.[0]?.external?.url || card.properties.titleImage?.files?.[0]?.file?.url;
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

async function fetchDataFromAPIEndPoint(){
  try {
    const cards = await fetch('/api/fetchNotion')
      .then((res) => res.json())
      .then((data) => data.results);
    
    console.log(cards);
    
    // Sort cards by ordering property
    allCards = cards.sort((a, b) => {
      const orderA = a.properties.ordering?.number || 999;
      const orderB = b.properties.ordering?.number || 999;
      return orderA - orderB;
    });
    
    // Render all cards initially
    renderCards(allCards);
    
    // Setup filter UI
    const tagOptions = await fetchTagOptions();
    setupFilterUI(tagOptions);
  } catch (error) {
    console.error('Error fetching data:', error);
    const cardContainer = document.querySelector('#app');
    if (cardContainer) {
      cardContainer.innerHTML = '<p>Unable to load projects at this time.</p>';
    }
  }
}

// Add smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch data
  await fetchDataFromAPIEndPoint();
  
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
