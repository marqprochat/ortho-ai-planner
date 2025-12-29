# Configuração no Easypanel

Para implantar este projeto no Easypanel, siga os passos abaixo:

## 1. Banco de Dados (PostgreSQL)
1. No Easypanel, clique em **"Create Project"**.
2. Vá em **"Service"** > **"Database"** > **"PostgreSQL"**.
3. Escolha um nome (ex: `database`).
4. Anote as credenciais (Password, DB Name, User).

## 2. Backend (API)
1. Crie um novo **"App"** chamado `backend`.
2. Em **"Source"**, conecte ao seu repositório Git.
3. Defina o **"Subpath"** para `./backend`.
4. Em **"Environment Variables"**, adicione:
   - `DATABASE_URL`: `postgresql://user:password@database-service:5432/dbname?schema=public` (Substitua as credenciais e o nome do host do banco no Easypanel).
   - `JWT_SECRET`: Uma chave aleatória segura.
   - `PORT`: `3000`.
5. Em **"Domains"**, configure o domínio da API (ex: `api.seudominio.com`).

## 3. Portal Frontend
1. Crie um novo **"App"** chamado `portal`.
2. Em **"Source"**, conecte ao seu repositório Git.
3. Defina o **"Subpath"** para `./apps/portal`.
4. Em **"Build"**, adicione o seguinte **"Build Argument"**:
   - `VITE_API_URL`: `https://api.seudominio.com/api` (O domínio que você configurou no backend).
5. Em **"Domains"**, configure o domínio do portal (ex: `portal.seudominio.com`).

## 4. Planner Frontend
1. Crie um novo **"App"** chamado `planner`.
2. Em **"Source"**, conecte ao seu repositório Git.
3. Defina o **"Subpath"** para `./apps/planner`.
4. Em **"Build"**, adicione o seguinte **"Build Argument"**:
   - `VITE_API_URL`: `https://api.seudominio.com/api`.
5. Em **"Domains"**, configure o domínio do planner (ex: `app.seudominio.com`).

---

## Dicas:
- Certifique-se de que a `DATABASE_URL` use o nome do serviço do banco de dados criado no Easypanel como host.
- O `VITE_API_URL` deve obrigatoriamente terminar com `/api`.
- Se você fizer mudanças no código, o Easypanel irá reconstruir automaticamente se o Webhook estiver configurado.
