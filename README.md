# Shopee Search, Gallery and Videos

Actor para buscar produtos públicos da Shopee Brasil por nome ou categoria, abrir os produtos encontrados e retornar os dados de produto e as URLs de imagens e vídeos que a página pública disponibilizar.

## Entrada

Informe **um** modo de busca: `searchQuery` ou `categoryUrl`. Opcionalmente, escolha `maxItems` de 1 a 50 (padrão 20).

Busca por nome:

```json
{
  "searchQuery": "fone bluetooth",
  "maxItems": 20
}
```

Busca por categoria (a URL precisa conter o ID da categoria):

```json
{
  "categoryUrl": "https://shopee.com.br/beleza-cat.11036670",
  "maxItems": 20
}
```

São aceitos apenas URLs `http`/`https` nos hosts `shopee.com.br` e `www.shopee.com.br`. O Actor lê os cartões que a página de busca carregar, usa os textos visíveis de vendas quando disponíveis, remove produtos duplicados e inspeciona no máximo `maxItems` URLs. Não percorre páginas de resultados adicionais.

## Ordenação por vendas

Os produtos com contagem de vendas reconhecida são emitidos do maior para o menor `soldCount`. Empates mantêm a ordem da página; produtos sem contagem ficam depois dos classificados e recebem `soldCount: null` e `salesRank: null`. A Shopee pode não mostrar vendas, ou mudar o texto e a estrutura da página; nesses casos não há como garantir a classificação real.

## Saída

Um item por produto, na ordem de vendas descrita acima:

```json
{
  "id": "7890123456",
  "url": "https://shopee.com.br/produto-exemplo-i.123456.7890123456",
  "title": "Nome do produto",
  "price": 39.9,
  "sellerName": "Loja exemplo",
  "sellerUrl": "https://shopee.com.br/loja-exemplo",
  "images": ["https://.../imagem-1.jpg", "https://.../imagem-2.jpg"],
  "videos": ["https://.../video.mp4"],
  "soldCount": 1200,
  "salesRank": 1,
  "scrapingStatus": "ok"
}
```

O Actor preserva os campos aceitos pelo conector do IDDA ONLINE e acrescenta `soldCount` e `salesRank`. Campos não expostos ficam `null` ou listas vazias. `scrapingStatus` pode ser `ok` (ao menos uma imagem encontrada), `partial` (página de produto aberta sem imagem detectada), `blocked` (sinais conhecidos de verificação de tráfego) ou `error` (falha ao abrir um produto). Bloqueio, falha ou busca sem produtos geram um item de diagnóstico com `searchUrl`, sem `url` de produto.

“Galeria completa” significa todas as URLs de imagem e vídeo que a página pública disponibilizou durante a execução. A Shopee pode ocultar mídias, alterar o formato da página ou exigir verificação; o Actor não faz login, não usa cookies de conta, proxies, modo stealth, endpoints privados ou resolução de desafios. Outras telas de bloqueio podem não ser reconhecidas. URLs de vídeo são retornadas como links; os arquivos não são baixados.

## Execução e publicação

Requer Node.js 24 para corresponder à imagem de execução do Actor. Na pasta `apify/shopee-detail-actor`:

```bash
npm ci
npm test
```

Para publicar pela sua conta, instale o Apify CLI (`npm install --global apify-cli`), autentique-se com `apify login` e, nesta pasta, execute `apify push`. Isso cria ou atualiza o Actor e inicia um build na Apify. Confira os custos e a configuração da conta antes de iniciar execuções; este repositório não contém credenciais.

O ID do Actor será `<seu-usuario>~shopee-detail-media`. No `.env` do IDDA ONLINE, configure a busca por nome:

```dotenv
APIFY_ATOR_SHOPEE=<seu-usuario>~shopee-detail-media
APIFY_ENTRADA_SHOPEE={"searchQuery":"{termo}","maxItems":{limite}}
```

Para direcionar as execuções do Actor a uma categoria, configure a entrada com uma URL de categoria:

```dotenv
APIFY_ENTRADA_SHOPEE={"categoryUrl":"https://shopee.com.br/beleza-cat.11036670","maxItems":{limite}}
```

Essa configuração fixa a categoria usada pelo conector atual do IDDA; a tela do IDDA ainda não oferece seleção dinâmica de categoria. Faça primeiro uma execução pequena no Console da Apify e confira o dataset, a classificação e o custo antes de conectar a coleta completa.
