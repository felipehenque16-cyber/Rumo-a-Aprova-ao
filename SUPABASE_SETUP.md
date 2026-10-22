# Configurar contas e sincronização do Caderno SS

A aplicação é um site estático. O Supabase fornece autenticação e armazenamento do progresso; não é necessário criar ou presumir um backend próprio.

## 1. Criar e configurar o projeto

1. Crie um projeto no [Supabase](https://supabase.com/dashboard).
2. No SQL Editor desse projeto, execute todo o conteúdo de `supabase/schema.sql`.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **publishable** (`sb_publishable_...`) ou a chave legada `anon` (`eyJ...`).
4. Preencha `window.__SUPABASE_URL__` e `window.__SUPABASE_ANON_KEY__` em `supabase-config.js` com esses dois valores.
5. Em **Authentication → URL Configuration**, adicione a URL pública do site (Vercel) como Site URL e como Redirect URL. Para desenvolvimento local, adicione também a origem local usada.
6. Em **Authentication → Sign In / Providers → Email**, habilite cadastro por e-mail. Com confirmação habilitada, cada pessoa deve confirmar o e-mail antes de entrar. Para envio confiável de mensagens em produção, configure SMTP próprio.

A tabela `public.user_progress` usa RLS e `auth.uid()` para permitir que cada conta leia e atualize somente o próprio progresso. A conta da sua esposa deve ser criada com o e-mail dela e ficará isolada da sua.

## 2. Login com Google (opcional)

Em **Authentication → Sign In / Providers → Google**, configure o Client ID e o Client Secret do Google. Cadastre no Google Cloud a URL de callback exibida pelo painel do Supabase em **Authorized redirect URIs**. O segredo fica somente nos painéis Google/Supabase; nunca em `index.html`, `supabase-config.js` ou no GitHub.

Como um segredo OAuth foi compartilhado anteriormente na conversa, revogue-o e gere outro antes de ativar o provedor.

## Chaves

`supabase-config.js` é entregue ao navegador: só deve conter a URL e a chave publicável/anon. Nunca use `service_role`, `sb_secret_...`, senha do banco ou segredo OAuth nesse arquivo.
