# ZIP Worker (Cloudflare)

Gera ZIPs on-the-fly a partir de uma lista de chaves do R2.

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

## Observacao de seguranca

Este worker assume que `listKey` e opaco. Se precisar, adicione token
assinado e validacao no worker.
