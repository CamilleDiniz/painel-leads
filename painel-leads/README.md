# Painel de Leads

CRM Kanban para leads de imóveis, alimentado automaticamente pela planilha de
Ads (Meta/Google Forms). Feito em Next.js, pronto pra publicar no Vercel.

**Importante — modo atual:** este projeto só **lê** a sua planilha. Nenhuma
ação feita no painel (mover card, marcar tentativa, marcar como perdido,
escrever resumo) é gravada de volta na planilha — tudo isso fica guardado
à parte, num banco pequeno (Upstash Redis). A planilha continua sendo só a
fonte dos leads, sem risco de mexer na integração de anúncios que já
funciona.

## O que você precisa configurar antes de publicar

### 1. Conta de serviço do Google (pra ler a planilha)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/), crie um projeto (ou use um existente).
2. Ative a **Google Sheets API** (menu "APIs e serviços" → "Ativar APIs e serviços").
3. Crie uma **conta de serviço** ("IAM e administrador" → "Contas de serviço" → "Criar conta de serviço").
4. Nessa conta de serviço, crie uma **chave** em formato JSON e baixe o arquivo.
5. Abra a sua planilha do Google Sheets, clique em "Compartilhar" e adicione o
   e-mail da conta de serviço (algo como `nome@projeto.iam.gserviceaccount.com`)
   com permissão de **Leitor** (visualizador) — não precisa dar acesso de edição.
6. Do arquivo JSON baixado, você vai usar dois campos no `.env`:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (cole o valor inteiro, com as quebras `\n`)

### 2. Banco de estado do Kanban (Upstash Redis)

1. No painel do seu projeto na Vercel, vá em "Storage" → "Marketplace Database Storage" → escolha **Upstash Redis** (tem plano gratuito).
2. Depois de criar, a Vercel mostra as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` — copie pro `.env` (ou já deixe conectado direto ao projeto, que ela preenche sozinha).

### 3. Senha de acesso ao painel

Você e a cliente entram com uma senha única compartilhada. Gere o hash dela
rodando localmente:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('SUA_SENHA_AQUI').digest('hex'))"
```

Copie o resultado para `PANEL_PASSWORD_HASH` no `.env`.

### 4. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha todos os valores.

## Rodando localmente

```bash
npm install
npm run build   # confere se está tudo certo
npm run dev     # sobe em http://localhost:3000
```

## Publicando no Vercel

1. Suba este projeto para um repositório no GitHub.
2. Na Vercel, "Add New Project" → importe o repositório.
3. Em "Environment Variables", cole todas as variáveis do seu `.env.local`.
4. Deploy. A cada push no GitHub, a Vercel publica automaticamente.

## Estrutura

- `lib/sheets.js` — leitura (somente leitura) da planilha via Google Sheets API.
- `lib/property.js` — identifica o empreendimento a partir do nome do anúncio (`ad_name`).
- `lib/phone.js` — normaliza o número de WhatsApp pra gerar o link `wa.me`.
- `lib/store.js` — guarda o estado do Kanban (coluna, tentativas, resumo, motivo de perda) no Upstash Redis — nunca na planilha.
- `app/api/leads` — junta os leads da planilha com o estado salvo.
- `app/api/card` — grava a movimentação/anotação de um card (não escreve na planilha).
- `app/page.js` — a interface do painel (Kanban, Perdidos, Funil, Configurações).
- `proxy.js` — protege todas as páginas com a senha compartilhada.

## Próximo passo (fora do escopo deste MVP)

Hoje a página busca a planilha sempre que é aberta, e também a cada 45
segundos automaticamente enquanto fica aberta — dá pra sentir a atualização
quase em tempo real. Quando você validar que está tudo funcionando bem,
o próximo passo é adicionar um gatilho na própria planilha (Google Apps
Script) que avisa o painel *no instante* em que um lead novo chega, em vez de
esperar o próximo ciclo de 45s. Isso exige alterar a planilha — então só
fazemos com sua aprovação explícita, como combinado.
