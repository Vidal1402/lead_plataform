import { GoogleMapsScraper } from '../scrapers/googleMapsScraper';

(async () => {
  const scraper = new GoogleMapsScraper();
  const leads = await scraper.scrape({
    nicho: 'pizzaria',
    cidade: 'São Paulo',
    pais: 'Brasil',
    quantidade: 3,
    userId: 'teste123'
  });
  console.log('Leads extraídos:', leads);
  process.exit(0);
})();