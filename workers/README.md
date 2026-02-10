# ZIP Worker (Cloudflare)

Gera ZIPs on-the-fly a partir de uma lista de chaves do R2.

## Deploy (wrangler)

O Wrangler trata `src/index.js` como JavaScript. Use a versão JS, não a TS:

1. No projeto de deploy (`zip-worker/zip-worker`), use como `src/index.js` o conteúdo de **`workers/zip-worker-index.js`** deste repositório (ou copie o arquivo para `src/index.js`).
2. Não copie `workers/zip-worker.ts` para `src/index.js`: ele contém sintaxe TypeScript (`type`, anotações) e causa erro de build ("Expected ';' but found 'R2Bucket'").
3. Mantenha a dependência `fflate` no `package.json` do projeto de deploy.
4. Rode `wrangler deploy` a partir da pasta do Worker.

## Variaveis esperadas

- `XML_BUCKET`: binding R2 com os XMLs e com as listas.

## Endpoint

`GET /zip?listKey=...&filename=...&concurrency=6`

- `listKey`: chave no R2 que aponta para um JSON array de chaves.
- `filename`: nome do arquivo final (opcional).
- `concurrency`: limite de downloads simultaneos (opcional, max 20).

## Formato da lista

JSON array de chaves ou objetos:

```json
[
  "12345678000190/xml/202501/CHAVE.xml",
  { "key": "12345678000190/xml/202501/CHAVE2.xml", "name": "NFE_2.xml" }
]
```

## Debug (contadores na resposta)

Para ver quantos arquivos foram adicionados ao ZIP **sem depender dos logs**:

- Acrescente **`&debug=1`** na URL do Worker (ex.: `.../zip?listKey=...&filename=...&debug=1`).
- O ZIP é gerado em modo buffer e a resposta traz os headers:
  - **X-Zip-Files-Added:** quantidade de arquivos encontrados no R2 e adicionados.
  - **X-Zip-Files-NotFound:** quantidade de keys que não retornaram objeto no R2.
  - **X-Zip-Files-Total:** total de entradas na lista.
- Abra a aba **Network** (F12 → Network), baixe o ZIP pela URL com `debug=1` e inspecione os **Response Headers** da requisição. Se `X-Zip-Files-Added: 0` e `X-Zip-Files-NotFound` igual ao total, as keys não batem com o bucket.

## Onde ver os logs na Cloudflare

- **Workers & Pages** → **zip-worker** → aba **Logs** (ou **Real-time Logs**): stream ao vivo de `console.log`/`console.warn` ao testar.
- Ou **Análise e logs** (sidebar) → **Pesquisa de logs** (Log Explorer): busque por `zip-worker` ou por mensagens `[Worker ZIP]`.

## Observacao de seguranca

Este worker assume que `listKey` e opaco. Se precisar, adicione token
assinado e validacao no worker.
