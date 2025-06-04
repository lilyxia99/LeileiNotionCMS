import './style.css'

async function fetchDataFromAPIEndPoint(){
  const cards = await fetch('/api/fetchNotion')
  .then((res)=>res.json()
  .then((data)=>data.results));
  console.log(cards);
  document.querySelector('.card-container').innerHTML=cards.map((card)=>`
         <article class="card">
          <img src="${card.properties.titleImage.files[0].external.url}" 
          alt="sign language mail pack cover" class="card__image">
          <h2 class="card__heading">${card.properties.Name.title[0].plain_text}</h2>
          <div class="card__content"><p>
            ${card.properties.description.rich_text[0].plain_text}
          </p></div>
       </article>
       `);
}

fetchDataFromAPIEndPoint();
