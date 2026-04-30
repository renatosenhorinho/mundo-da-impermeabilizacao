import os
import re
import time
import requests
import unicodedata
from duckduckgo_search import DDGS

fitas = [
    "Viapol Betufita 15cm Fita Asfáltica Aluminizada",
    "Viapol Betufita 20cm Fita Asfáltica Aluminizada",
    "Viapol Betufita 94cm Fita Asfáltica Aluminizada",
    "Viapol Viaflex Sleeve Telha Fita Aluminizada",
    "Dryko Fita Vedatudo 10cm Fita Asfáltica Aluminizada",
    "Dryko Fita Vedatudo 15cm Fita Asfáltica Aluminizada",
    "Dryko Fita Vedatudo 20cm Fita Asfáltica Aluminizada",
    "Dryko Fita Vedatudo 30cm Fita Asfáltica Aluminizada",
    "Dryko Fita Vedatudo 60cm Fita Asfáltica Aluminizada",
    "Dryko Drykomanta Vedatudo AL Tipo I Manta Adesiva",
    "Plastiband 10cm Fita Asfáltica Aluminizada",
    "Plastiband 15cm Fita Asfáltica Aluminizada",
    "Plastiband 20cm Fita Asfáltica Aluminizada",
    "Plastiband 30cm Fita Asfáltica Aluminizada",
    "Plastiband 45cm Fita Asfáltica Aluminizada",
    "Plastiband 60cm Fita Asfáltica Aluminizada",
    "Plastiband 90cm Fita Asfáltica Aluminizada",
    "Vedacit Pro Adesivo Elastomérico Fita Aluminizada",
    "Q-Borg Uso Geral 10cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 15cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 20cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 30cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 45cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 60cm Fita Asfáltica Aluminizada",
    "Q-Borg Uso Geral 90cm Fita Asfáltica Aluminizada"
]

selantes = [
    "Viapol Heydicryl Mástique Acrílico (5kg)",
    "Poliplas Silicone Acético Incolor",
    "Poxpur Silicone Acético Uso Geral Incolor",
    "Q-Borg PU 40 Multiuso Branco (Bisnaga)",
    "Q-Borg PU 40 Multiuso Branco (800g)",
    "Q-Borg PU 40 Multiuso Cinza (310ml)",
    "Q-Borg PU 40 Multiuso Cinza (Sachê)",
    "Q-Borg PU 40 Multiuso Preto (Bisnaga)",
    "Q-Borg PU 40 Multiuso Preto (Sachê)",
    "Q-Borg PU Q-25 Premium Branco",
    "Q-Borg PU Q-25 Premium Cinza",
    "Q-Borg Pro Selante para Calhas e Rufos Cinza",
    "Q-Borg Pro Silicone Acético Incolor",
    "Q-Borg Silicone Neutro Incolor",
    "Ultra Ved PU 40 Multiuso Branco (400g)",
    "Ultra Ved PU 40 Multiuso Cinza (400g)",
    "Ultra Ved PU 40 Multiuso Preto (400g)",
    "Ultra Ved PU 40 Professional Branco (800g)"
]

categories = {
    "fitas-aluminizadas": fitas,
    "selantes": selantes
}

base_dir = r"C:\Users\renat\OneDrive\Documentos\GitHub\scripts\imgs"

def slugify(text):
    text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8")
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text).strip("-")
    return text

def download_image(url, filepath):
    try:
        response = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        if response.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return False

def search_and_download():
    ddgs = DDGS()
    report = {"baixados": [], "nao_encontrados": [], "falhas": []}
    
    for cat_slug, products in categories.items():
        cat_dir = os.path.join(base_dir, cat_slug)
        os.makedirs(cat_dir, exist_ok=True)
        
        for prod in products:
            slug = slugify(prod)
            filepath = os.path.join(cat_dir, f"{slug}.jpg")
            
            if os.path.exists(filepath):
                print(f"Ja existe: {prod}")
                report["baixados"].append(prod)
                continue
                
            query = f'{prod} produto embalagem'
            print(f"Buscando: {query}")
            
            try:
                results = list(ddgs.images(query, max_results=3))
                if not results:
                    query = f'{prod} embalagem'
                    results = list(ddgs.images(query, max_results=3))
                    
                if results:
                    success = False
                    for res in results:
                        img_url = res.get("image")
                        if img_url and download_image(img_url, filepath):
                            report["baixados"].append(prod)
                            success = True
                            print(f"[SUCESSO] {prod}")
                            break
                    if not success:
                        report["falhas"].append(prod)
                        print(f"[FALHA DOWNLOAD] {prod}")
                else:
                    report["nao_encontrados"].append(prod)
                    print(f"[NAO ENCONTRADO] {prod}")
            except Exception as e:
                print(f"[ERRO] {prod}: {e}")
                report["falhas"].append(prod)
                
            time.sleep(2) # rate limit
            
    # Gera relatório
    print("\n--- RELATORIO FINAL ---")
    print(f"Imagens baixadas: {len(report['baixados'])}")
    print(f"Falhas (erro de download): {len(report['falhas'])}")
    print(f"Nao encontrados: {len(report['nao_encontrados'])}")
    
    print("\nNao encontrados / Falhas:")
    for item in report["nao_encontrados"] + report["falhas"]:
        print(f"- {item}")

if __name__ == "__main__":
    search_and_download()
