# Etapa 3 — Autenticação

Etapa concluída em 14/09/2026, horário de São Paulo. Implementação integrada entre
React/TypeScript, Express/TypeScript, Prisma e PostgreSQL 17. As páginas internas
mantêm o conteúdo temporário e o sistema visual aprovados na Etapa 2.

## 1. Arquivos criados

### Backend e banco

- `backend/prisma/migrations/20260915024133_stage3_authentication/migration.sql`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/src/controllers/auth-cookies.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/middlewares/authenticate.ts`
- `backend/src/middlewares/origin-guard.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/services/auth-error.ts`
- `backend/src/services/auth-tokens.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/validators/auth.schemas.ts`
- `backend/src/tests/auth.test.ts`

### Frontend

- `frontend/src/auth/auth-api.ts`
- `frontend/src/auth/auth-context.ts`
- `frontend/src/auth/auth-schemas.ts`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/auth/AuthGuard.tsx`
- `frontend/src/components/auth/AuthLayout.tsx`
- `frontend/src/components/auth/FormField.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/styles/auth.css`

### Validação e documentação

- `scripts/auth-browser-check.mjs`
- `docs/etapa-3-autenticacao.md`

## 2. Arquivos alterados

- `.env.example`: origem autorizada e instrução para gerar o segredo JWT.
- `README.md`: configuração, endpoints, migrations e testes da autenticação.
- `package.json`: scripts `test:auth` e `test:auth:browser`.
- `package-lock.json`: dependências dos workspaces.
- `backend/package.json`: dependências e script de testes.
- `backend/prisma/schema.prisma`: modelos de usuário e sessão.
- `backend/src/app.ts`: parser JSON, cookies, proteção de origem e rotas de autenticação.
- `backend/src/config/env.ts`: validação de origem, chave JWT e HTTPS em produção.
- `backend/src/middlewares/error-handler.ts`: erros de autenticação, Zod e corpo inválido.
- `backend/tsconfig.build.json`: exclusão dos testes do artefato de produção.
- `frontend/package.json`: React Hook Form, resolver e Zod.
- `frontend/src/App.tsx`: provider de autenticação.
- `frontend/src/routes/AppRoutes.tsx`: páginas públicas e rotas privadas.
- `frontend/src/components/navigation/Sidebar.tsx`: nome, email e inicial reais.
- `frontend/src/components/navigation/Topbar.tsx`: logout com loading e erro.
- `frontend/src/styles.css`: importação dos estilos de autenticação.
- `frontend/src/styles/tokens.css`: token de cor para erros acessíveis.

O `.env` local, ignorado pelo Git, recebeu uma chave JWT aleatória e a origem do
frontend. Credenciais do PostgreSQL foram preservadas. O client Prisma e os builds
foram regenerados nos diretórios já ignorados. `backend/src/server.ts` não precisou
de alteração. Não houve commit, push ou alteração de configurações globais.

## 3. Dependências adicionadas

| Workspace                | Dependência          | Versão | Uso                                  |
| ------------------------ | -------------------- | ------ | ------------------------------------ |
| Backend                  | bcrypt               | 6.0.0  | Hash de senha                        |
| Backend                  | jose                 | 6.2.12 | Assinatura e verificação JWT         |
| Backend                  | cookie-parser        | 1.4.7  | Leitura dos cookies                  |
| Backend                  | express-rate-limit   | 8.7.0  | Limitação de tentativas              |
| Backend, desenvolvimento | @types/bcrypt        | 6.0.0  | Tipos                                |
| Backend, desenvolvimento | @types/cookie-parser | 1.4.10 | Tipos                                |
| Frontend                 | react-hook-form      | 7.88.0 | Formulários                          |
| Frontend                 | @hookform/resolvers  | 5.9.1  | Integração com Zod                   |
| Frontend                 | zod                  | 4.6.5  | Validação de formulários e respostas |

O backend reutiliza o Zod existente. Não foi adicionado framework de testes:
a suíte HTTP usa `node:test`, e o teste de navegador usa o protocolo CDP do Chrome.

## 4. Schema Prisma

`User`: `id` UUID, `name` (100 caracteres), `email` único (254 caracteres),
`passwordHash` (60 caracteres), `timezone` (100 caracteres, padrão
`America/Sao_Paulo`), `createdAt`, `updatedAt` e relação `sessions`.

`AuthSession`: `id` UUID, `userId` UUID, `refreshTokenHash` (64 caracteres),
`expiresAt`, `revokedAt` opcional, `createdAt`, `updatedAt` e relação `user`.

Relação de um usuário para muitas sessões, com exclusão em cascata. Índices em
`userId` e `expiresAt`; email com índice único. Datas usam `TIMESTAMPTZ(3)`.
Emails são normalizados para minúsculas e sem espaços externos antes da gravação.

## 5. Migration

`20260915024133_stage3_authentication`, criada e aplicada com:

```sh
npm run db:migrate -- --name stage3_authentication
```

A numeração da migration usa UTC, por isso começa em 15/09. Foram criadas somente
as duas entidades de autenticação. Prisma confirmou banco e schema sincronizados.
Não foi usado `db push`, SQLite ou reset do banco.

## 6. Endpoints implementados

| Método e endpoint            | Comportamento                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register` | Valida nome, email, senha e timezone opcional; cria usuário e sessão atomicamente; `201` |
| `POST /api/v1/auth/login`    | Valida credenciais; cria sessão; `200`                                                   |
| `POST /api/v1/auth/refresh`  | Consome refresh atual e grava novo hash; renova cookies; `200`                           |
| `POST /api/v1/auth/logout`   | Revoga sessão correspondente e remove cookies; idempotente; `204`                        |
| `GET /api/v1/auth/me`        | Exige JWT e sessão ativos; retorna usuário público; `200` ou `401`                       |

Respostas de usuário contêm exclusivamente `id`, `name`, `email` e `timezone`.
Não retornam tokens ou hashes em JSON. Erros têm código e mensagem pública;
falhas internas não expõem exceções nem credenciais. Respostas de autenticação
e erros usam `Cache-Control: no-store`.

## 7. Estratégia de autenticação

- Senhas: bcrypt assíncrono, custo 12; mínimo de 8 caracteres e limite de 72
  bytes UTF-8, validado antes do hashing para impedir truncamento silencioso.
- JWT: HS256 com chave aleatória de 256 bits; validade de 15 minutos;
  `sub`, `sid`, `iat`, `exp`, issuer, audience e algoritmo verificados.
- Refresh: UUID da sessão mais segredo aleatório de 32 bytes; somente SHA-256
  do token completo é armazenado. Hash rápido é adequado ao segredo de alta
  entropia; senhas continuam usando bcrypt.
- Sessão: expiração absoluta de 7 dias, sem extensão indefinida por refresh.
- Middleware: verifica JWT e consulta sessão ativa no PostgreSQL. Identidade e
  sessão entram em `response.locals`, derivadas exclusivamente da autenticação.
- Logout: revogação é verificada mesmo para um JWT que ainda não expirou.
  Outras sessões do mesmo usuário permanecem válidas.
- Login inválido: mensagem idêntica para conta ausente e senha incorreta,
  com comparação bcrypt também para contas ausentes.
- Validação: objetos de entrada estritos rejeitam campos adicionais como `userId`.
- Limites: cadastro/login compartilham 20 tentativas por IP a cada 15 minutos;
  refresh permite 60 por IP por minuto, com `429` e `Retry-After`.

O limite de 72 bytes segue o comportamento documentado pelo
[projeto bcrypt](https://github.com/kelektiv/node.bcrypt.js).

## 8. Cookies, refresh e CSRF

| Cookie            | Caminho        | Duração                   | Flags                  |
| ----------------- | -------------- | ------------------------- | ---------------------- |
| `devflow_access`  | `/api`         | 15 minutos                | HttpOnly, SameSite=Lax |
| `devflow_refresh` | `/api/v1/auth` | Até a expiração da sessão | HttpOnly, SameSite=Lax |

Em produção, ambos recebem `Secure` e prefixo `__Secure-`. Não há atributo
`Domain`; cookies ficam restritos ao host. Logout limpa cada cookie com os mesmos
caminhos e flags. Nenhuma autenticação é salva em localStorage ou sessionStorage.

A API exige `Origin` exatamente igual a `APP_ORIGIN` e o header
`X-DevFlow-Request: 1` nas operações de escrita, inclusive login e cadastro.
Origens externas, `null`, ausentes em escritas ou Fetch Metadata `cross-site`
são rejeitadas. Preflight permite somente a origem configurada, sem wildcard.
Esse uso conjunto de header customizado e origem restrita segue a abordagem
documentada pela [OWASP para APIs AJAX](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi).

A rotação usa `UPDATE` condicionado ao hash anterior, sessão não revogada e
expiração futura. Duas requisições concorrentes produzem um único vencedor.
Token consumido ou conflito retorna `409`, sem sobrescrever ou limpar cookies
instalados pelo vencedor. Sessões ausentes, expiradas ou revogadas retornam `401`.

No frontend, uma Promise compartilha consultas concorrentes; Web Locks coordena
renovação, login e logout entre abas. Um `401` em `/me` tenta um refresh; um `409`
faz somente uma nova consulta a `/me`, sem repetir o token antigo. Não há loop
de refresh. BroadcastChannel transmite apenas uma notificação de mudança.

## 9. Rotas protegidas e interface

`/dashboard`, `/projetos`, `/clientes`, `/tarefas`, `/financeiro`, `/horas` e
`/configuracoes` exigem sessão. Durante a descoberta, o layout privado não é
renderizado. Visitantes vão para `/login`; após entrar, voltam à rota solicitada
quando ela pertence à lista de rotas internas. URLs externas não são aceitas.

`/login` e `/register` são públicas para visitantes; usuários já autenticados são
redirecionados. O guarda concentra essa decisão para evitar redirecionamentos
concorrentes entre formulário e rota. O usuário é restaurado por `/auth/me` no
reload. Verificação adicional ocorre ao receber foco, por notificação de outra
aba e a cada minuto enquanto a página estiver visível.

Falha de rede na descoberta mostra mensagem e botão para tentar novamente.
Falha no logout mantém o estado e permite repetir, sem anunciar sucesso falso.

Design em React/Vite: coluna compacta de formulário, fonte Inter, superfícies
escuras existentes e marca DevFlow com o mesmo símbolo. Azul restrito à ação
principal e foco. Sem gradients, glow, glassmorphism ou novos painéis decorativos.
Não houve uso de referências externas de componentes. Labels associados,
autocompletes, erros vinculados por `aria-describedby`, foco visível, loading
e envio por teclado foram implementados. Sidebar mostra nome/email reais;
logout fica discretamente na topbar. Não foi criada página de perfil.

## 10. Validações e resultados

| Verificação                                          | Resultado                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Migration real no PostgreSQL 17                      | Aplicada; banco sincronizado                                              |
| `npm run db:validate`                                | Aprovado                                                                  |
| `npm run db:generate`                                | Aprovado                                                                  |
| `npm run db:check`                                   | `SELECT 1` executado com sucesso                                          |
| `npm run test:auth`                                  | 16 cenários aprovados; runner contabiliza 17 testes incluindo o agrupador |
| Mesma suíte com `NODE_ENV=production` e origem HTTPS | Aprovada; flags Secure e prefixos verificados                             |
| `npm run test:auth:browser`                          | Aprovado em Chrome 153, API e banco reais                                 |
| `npm run lint`                                       | Aprovado, zero warnings                                                   |
| `npm run typecheck`                                  | Aprovado, frontend e backend                                              |
| `npm run build`                                      | Aprovado; aviso de tamanho do bundle descrito abaixo                      |
| `npm run format:check`                               | Aprovado                                                                  |
| `npm run check`                                      | Aprovado                                                                  |
| `git diff --check`                                   | Aprovado                                                                  |
| `npm audit`                                          | Zero vulnerabilidades reportadas                                          |

A suíte HTTP cobre cadastro válido/duplicado, login válido/inválido, `/me` com
e sem autenticação, ausência de campos sensíveis, bcrypt, cookies, JWT expirado,
assinatura/algoritmo/audience inválidos, refresh sem access token, rotação, replay,
concorrência, CSRF, CORS, ownership, limite de senha em bytes, timezone, JSON
malformado, corpo excessivo, logout, sessão revogada/expirada e rate limiting.

O navegador verificou as sete rotas privadas antes/depois da autenticação,
cadastro e confirmação de senha, mensagens de erro, reload com/sem access cookie,
rotação, identidade real e ausência de tokens acessíveis por JavaScript.
Dezesseis chamadas simultâneas em duas abas geraram um único refresh. Logout
sincronizou as abas. Login via Enter retornou a `/projetos`. Menu móvel, Escape,
foco visível e ausência de overflow entre 320 e 1440 px passaram. Nenhuma exceção
JavaScript foi capturada. Capturas foram inspecionadas em `/private/tmp/devflow-stage3`.

Ambas as suítes removem exclusivamente seus usuários temporários e sessões.
Restrições de sockets/rede do sandbox exigiram execuções autorizadas fora dele
para banco, servidor, navegador e auditoria npm.

## 11. Decisões técnicas relevantes

- Monólito modular e pastas existentes mantidos: controllers, services, routes e
  middlewares. Sem reorganização das etapas anteriores ou microserviços.
- Cadastro de usuário e primeira sessão na mesma operação aninhada do Prisma.
- Cookies para ambos os tokens; segredo JWT disponível somente no backend.
- Consulta de sessão em cada endpoint protegido para revogação imediata.
- Expiração absoluta evita sessões renovadas indefinidamente.
- Rotação atômica funciona também com mais de um processo de API, porque a
  exclusão do token consumido é garantida pelo PostgreSQL.
- Um replay não revoga automaticamente toda a sessão: ele é rejeitado sem
  derrubar o vencedor de uma requisição concorrente. Não há histórico de tokens.
- Componentes novos limitados ao formulário e layout de autenticação.
- Testes HTTP reproduzíveis com PostgreSQL real, sem dependências de mocks ou
  biblioteca adicional de automação de navegador.

## 12. Limitações e pontos para revisão

- O rate limiter é em memória por processo. Um deploy com várias instâncias ou
  proxy precisa revisar armazenamento compartilhado e confiança restrita no proxy.
- HTTPS real de produção não foi publicado/testado. A configuração de produção
  e os headers foram testados localmente; publicação requer origem e chave próprias.
- Sem Web Locks, a Promise ainda coordena a mesma aba e o banco continua seguro,
  mas uma disputa entre abas pode exigir novo login. Validação de navegador foi
  feita em Chrome; Safari/Firefox e leitores de tela não foram testados.
- Cadastro duplicado recebe mensagem genérica, mas a diferença de status frente
  ao cadastro bem-sucedido permite inferência de existência da conta. Eliminar
  essa diferença exigiria outro fluxo de cadastro, fora desta etapa.
- Sessões expiradas/revogadas permanecem no banco. Uma rotina de retenção pode
  ser definida quando houver requisitos operacionais; não foi criado um agendador.
- O build informa um chunk JavaScript de aproximadamente 611 kB minificado
  (186 kB gzip), acima do aviso padrão de 500 kB. O build termina com sucesso;
  divisão de código pode ser avaliada sem alterar as funcionalidades entregues.
- OAuth, recuperação de senha, confirmação de email, 2FA, RBAC e funcionalidades
  de Clientes/Projetos/Tasks/Financeiro não fazem parte desta entrega.

**A ETAPA 3 foi concluída. Não houve avanço para a Etapa 4.**
