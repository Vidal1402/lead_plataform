# scraper.py
import asyncio
import re
from playwright.async_api import async_playwright

async def extrair_leads(nicho, cidade, max_resultados=20, userId="N/A"):
    print(f"[SCRAPER] Iniciando busca para nicho='{nicho}', cidade='{cidade}', limite={max_resultados}")
    contatos = []
    pesquisa = f"{nicho} {cidade}"

    async with async_playwright() as p:
        print("[SCRAPER] Abrindo navegador...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

        print("[SCRAPER] Acessando Google Maps...")
        await page.goto("https://www.google.com/maps")
        await page.fill("input#searchboxinput", pesquisa)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(3000)

        resultados_processados = 0
        tentativas_paginacao = 0
        max_tentativas = 10

        while len(contatos) < max_resultados and tentativas_paginacao < max_tentativas:
            print(f"[SCRAPER] Tentativa de paginação #{tentativas_paginacao + 1}")
            elementos = await page.query_selector_all("a.hfpxzc")
            links = [await el.get_attribute("href") for el in elementos if await el.get_attribute("href")]
            links_novos = links[resultados_processados:]
            resultados_processados = len(links)

            for link in links_novos:
                if len(contatos) >= max_resultados:
                    break
                try:
                    print(f"[SCRAPER] Abrindo página do lead: {link}")
                    nova_page = await browser.new_page()
                    await nova_page.set_extra_http_headers({
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    })
                    await nova_page.goto(link, timeout=30000)
                    await nova_page.wait_for_timeout(1500)

                    nome = await nova_page.title()
                    html = await nova_page.content()

                    telefone = "N/A"
                    try:
                        telefone_element = await nova_page.query_selector('button[data-item-id="phone"]')
                        if telefone_element:
                            telefone = await telefone_element.inner_text()
                    except Exception as e:
                        print(f"[SCRAPER] Erro ao buscar telefone: {e}")

                    if telefone == "N/A":
                        tel_match = re.findall(r"\(?\d{2,3}\)?\s?\d{4,5}-\d{4}", html)
                        if tel_match:
                            telefone = tel_match[0]

                    site = "N/A"
                    try:
                        site_element = await nova_page.query_selector('a[data-item-id="authority"]')
                        if site_element:
                            site = await site_element.get_attribute('href')
                    except Exception as e:
                        print(f"[SCRAPER] Erro ao buscar site: {e}")

                    email = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", html)
                    email = email[0] if email else "N/A"

                    if email == "N/A" and site != "N/A":
                        try:
                            site_page = await browser.new_page()
                            await site_page.set_extra_http_headers({
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            })
                            await site_page.goto(site, timeout=10000)
                            site_html = await site_page.content()
                            email_site = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", site_html)
                            if email_site:
                                email = email_site[0]
                            await site_page.close()
                        except Exception as e:
                            print(f"[SCRAPER] Erro ao buscar email no site: {e}")

                    contatos.append({
                        "nome": nome,
                        "telefone": telefone,
                        "email": email,
                        "site": site,
                        "nicho": nicho,
                        "cidade": cidade,
                        "userId": userId
                    })

                    await nova_page.close()
                except Exception as e:
                    print(f"[SCRAPER] Erro em {link}: {e}")

            await page.mouse.wheel(0, 3000)
            await page.wait_for_timeout(2000)
            tentativas_paginacao += 1

        await browser.close()
    print(f"[SCRAPER] Finalizado com {len(contatos)} contatos.")
    return contatos
