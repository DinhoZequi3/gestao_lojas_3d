# Gestão de Lojas — Impressão 3D

Site estático (HTML + CSS + JS puro, sem build, sem servidor) para gerenciar preços e custos
dos seus produtos na Shopee, Mercado Livre e TikTok Shop.

Os dados ficam salvos no `localStorage` do navegador — ou seja, tudo roda no seu computador,
sem nenhum banco de dados externo. Use o botão **"Exportar backup"** de vez em quando para
não perder nada e para levar seus dados de um dispositivo pro outro.

## Como hospedar no GitHub Pages (passo a passo)

1. Crie um repositório novo no GitHub (pode ser público ou privado — Pages funciona nos dois
   se sua conta tiver GitHub Pro/Team/Enterprise; contas free só publicam repositórios públicos).
2. Suba estes arquivos para a raiz do repositório (todos soltos, sem pastas):
   ```
   index.html
   styles.css
   app.js
   ```
   Pode arrastar e soltar pela interface web do GitHub ("Add file" → "Upload files"), ou via
   git:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do site de gestão de lojas"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```
3. No repositório, vá em **Settings → Pages**.
4. Em "Build and deployment" → "Source", escolha **Deploy from a branch**.
5. Em "Branch", escolha **main** e a pasta **/ (root)**, depois clique em **Save**.
6. Espere 1–2 minutos. O GitHub mostra o link no topo da mesma página, algo como:
   `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`

Pronto — é só acessar esse link (e adicionar aos favoritos/tela inicial do celular).

## Estrutura do projeto

- `index.html` — estrutura da página e menu lateral
- `styles.css` — visual (cores, tabelas, layout responsivo)
- `app.js` — toda a lógica: estado, cálculos, salvar/carregar, exportar/importar

## Funcionalidades

- **Filamentos**: cadastre cada filamento com preço por kg.
- **Parâmetros**: potência da A1, da A1 mini e tarifa de energia (R$/kWh) — usados no
  cálculo de custo de energia.
- **Shopee / Mercado Livre / TikTok Shop**: uma tabela de produtos por loja, com:
  - Preço de venda e valor recebido → calcula a taxa da plataforma (R$ e %)
  - Peso (g) + filamento selecionado → calcula custo de filamento
  - Tempo de impressão (h) + impressora selecionada → calcula custo de energia
  - Embalagem e gasto para levar → somados ao custo total
  - Lucro líquido e margem (%) calculados automaticamente, com selo colorido
    (verde ≥ 40%, amarelo 20–40%, vermelho < 20%)
  - Exportação da tabela em CSV (abre direto no Excel/Google Sheets)
- **Resumo**: totais de faturamento, custo e lucro de todas as lojas juntas.
- **Exportar/Importar backup (JSON)**: para não perder dados e mover entre dispositivos.

## Limitações importantes

- Os dados **não sincronizam automaticamente** entre navegadores ou dispositivos —
  cada um guarda sua própria cópia local. Use o backup JSON para transferir.
- Limpar os dados de navegação/cache do navegador apaga os dados salvos — exporte um
  backup antes de fazer isso.
- Não há login/senha porque não há servidor. Se no futuro você quiser multiusuário,
  sincronização entre aparelhos, etc., vai precisar de um backend (ex: Supabase, Firebase)
  — posso ajudar a evoluir para isso quando quiser.
