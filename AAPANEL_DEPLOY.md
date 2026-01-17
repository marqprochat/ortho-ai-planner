# Guia de Instalação no aaPanel via Docker

Este guia explica como implantar a aplicação **Ortho AI Planner** no seu servidor aaPanel utilizando Docker.

## Pré-requisitos

1.  **Servidor com aaPanel instalado**.
2.  **Docker Manager** instalado no aaPanel (Vá em "App Store" -> procure por "Docker" -> Instale o "Docker Manager").
3.  **Acesso SSH** ou **Terminal** do aaPanel.
4.  **Domínio apontado para o IP do servidor** (Recomendado, mas pode usar IP).

## Passo 1: Preparar os Arquivos

Você precisa enviar os arquivos do projeto para o servidor. Recomendo criar uma pasta em `/www/wwwroot/ortho-ai-planner`.

Você pode fazer isso de duas formas:
1.  **Via Git (Recomendado):**
    Abra o terminal e rode:
    ```bash
    cd /www/wwwroot
    git clone https://seu-repositorio.git ortho-ai-planner
    cd ortho-ai-planner
    ```
2.  **Via Gerenciador de Arquivos:**
    Compacte sua pasta do projeto em um `.zip`, faça upload para `/www/wwwroot/` e descompacte.

## Passo 2: Configurar Variáveis de Ambiente

No diretório do projeto (`/www/wwwroot/ortho-ai-planner`), crie um arquivo chamado `.env`.
Este arquivo definirá as senhas e, **muito importante**, os URLs públicos da sua aplicação.

Crie o arquivo `.env` com o seguinte conteúdo (ajuste os valores):

```env
# Banco de Dados
DB_USER=ortho
DB_PASSWORD=sua_senha_segura_db
DB_NAME=portalclinicas

# Backend (Segurança)
JWT_SECRET=sua_chave_secreta_jwt_muito_longa

# URLs Públicas (IMPORTANTE: Use seu Domínio ou IP Público)
# Estes valores são "assados" no frontend durante o build. Se mudar, precisa rebuildar.
# Exemplo se usar domínio: https://api.seudominio.com
# Exemplo se usar IP: http://SEU_IP_PUBLICO:3000/api

VITE_API_URL=http://SEU_IP_PUBLICO:3000/api
VITE_PLANNER_URL=http://SEU_IP_PUBLICO:8080
```

> **Nota:** Se você for usar domínios configurados no Nginx do aaPanel para proxy reverso (ex: `api.site.com` -> `localhost:3000`), coloque aqui os domínios finais com `https`.

## Passo 3: Iniciar o Projeto via Docker

### Opção A: Via Terminal (Mais Confiável)

1.  Acesse o terminal do servidor.
2.  Navegue até a pasta:
    ```bash
    cd /www/wwwroot/ortho-ai-planner
    ```
3.  Execute o comando para subir os containers:
    ```bash
    docker-compose up -d --build
    ```
    *   `-d`: Roda em segundo plano (detached).
    *   `--build`: Força a construção das imagens (importante para pegar as variáveis `VITE_` novas).

> **Atenção:** O arquivo `docker-compose.yml` foi configurado para expor o banco de dados na porta **5433** do host (para evitar conflito com o PostgreSQL padrão do aaPanel que usa a 5432). Se precisar acessar o banco externamente, use a porta 5433.

### Opção B: Via Interface do aaPanel

1.  Abra o **Docker** no menu lateral.
2.  Vá em **Project** (ou "Compose").
3.  Clique em **Add Project**.
4.  **Project Name:** `ortho-ai-planner`
5.  **Path:** Selecione a pasta `/www/wwwroot/ortho-ai-planner`.
6.  Clique em **Add** ou **Build/Run**.

> **Nota Importante sobre Uploads:** O backend está configurado para aceitar até 50MB. Certifique-se de que a configuração do Nginx no aaPanel também permita uploads desse tamanho (`client_max_body_size 50M;`), caso contrário você receberá erros 413. O frontend já possui validação para prevenir envio de arquivos maiores que 45MB.

## Passo 4: Configurar o Acesso Externo (Reverse Proxy)

Agora seus containers estão rodando nas portas:
*   Backend: 3000
*   Portal: 5173
*   Planner: 8080

Para acessar via domínio (ex: `app.seudominio.com`) e ter HTTPS, use o recurso "Website" do aaPanel:

1.  Vá em **Website** -> **Add Site**.
2.  **Domain:** `app.seudominio.com` (para o Portal).
3.  **PHP Version:** Static (não precisa de PHP).
4.  Crie o site.
5.  Vá nas configurações do site criado -> **Reverse Proxy**.
6.  **Add Reverse Proxy**:
    *   **Name:** PortalApp
    *   **Url:** `http://127.0.0.1:5173`
    *   Salve.

Repita para o Planner (`planner.seudominio.com` -> `http://127.0.0.1:8080`) e para a API (`api.seudominio.com` -> `http://127.0.0.1:3000`).

## Comandos Úteis

*   **Ver logs:** `docker-compose logs -f`
*   **Reiniciar:** `docker-compose restart`
*   **Parar e remover:** `docker-compose down`
*   **Atualizar/Rebuildar:** `docker-compose up -d --build` (Sempre rode isso se mudar o `.env`)
