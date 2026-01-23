## Criar email xml@sistemacaixafacil.com.br (Amazon WorkMail)

Regiao recomendada: Sao Paulo (sa-east-1). Como voce esta em Sorocaba, essa regiao tende a ter menor latencia.

### 1) Criar uma organizacao WorkMail
1. Acesse o AWS Console e abra o servico **WorkMail**.
2. Clique em **Create organization**.
3. Selecione a regiao **Sao Paulo (sa-east-1)**.
4. Defina um nome para a organizacao (ex: `caixafacil`).
5. Conclua a criacao.

### 2) Adicionar o dominio
1. Dentro da organizacao, abra **Domains**.
2. Clique em **Add domain**.
3. Informe o dominio: `sistemacaixafacil.com.br`.
4. O AWS vai mostrar os registros DNS de validacao.

### 3) Configurar DNS no seu provedor
Adicione os registros fornecidos pelo WorkMail (geralmente):
- TXT para validacao do dominio
- MX para receber emails
- CNAME para autodiscover (opcional)
- SPF/DKIM (recomendado)

Depois disso, volte no WorkMail e clique em **Verify**.

### 4) Criar o usuario de email
1. WorkMail -> **Users**.
2. Clique em **Create user**.
3. Usuario: `xml`
4. Email: `xml@sistemacaixafacil.com.br`
5. Defina uma senha forte.
6. Salve.

### 5) Ativar a caixa postal
Na lista de usuarios, selecione `xml` e clique em **Enable** (mailbox).

### 6) Dados IMAP para o monitor
Use estes dados no seu sistema:

Host: imap.mail.us-east-1.awsapps.com
Porta: 993
SSL: true
Usuario: xml@caixafacil.awsapps.com
Senha: (a senha criada)

### 7) (Opcional) SMTP do WorkMail
Se quiser enviar emails pelo WorkMail:

Host SMTP: smtp.mail.sa-east-1.awsapps.com
Porta: 465 (SSL) ou 587 (TLS)

---
Se quiser, me diga qual provedor DNS voce usa (ex: Registro.br, Cloudflare, etc) e eu ajudo a preencher os registros certinhos.
