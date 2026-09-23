# Landing pública e screenshots reais do DevFlow

## Estado inicial e escopo

O workspace já continha a implementação válida da Landing pública, ainda sem
commit. Essas alterações foram preservadas integralmente. Não houve commit, push
ou deploy.

A atualização usa React, TypeScript, Vite, o CSS e os ícones Lucide existentes.
Nenhuma dependência, endpoint, migration ou regra de negócio foi adicionada.
Backend, Prisma, autenticação e telas internas não foram redesenhados.

## Conta e dados demo locais

Foi criada uma conta local isolada e fictícia:

- Nome: Marina Costa.
- E-mail: `demo@devflow.local`.
- Fuso: `America/Sao_Paulo`.
- A senha local não foi escrita no repositório.

Os registros estão associados exclusivamente ao `userId` dessa conta. Nenhum
usuário ou dado preexistente foi alterado.

Clientes:

1. Aurora Studio — Aurora Studio Criativo.
2. North Labs — North Labs Tecnologia.
3. Pixel House — Pixel House Design.

Projetos:

| Projeto                  | Cliente       | Status       |  Progresso |   Budget |
| ------------------------ | ------------- | ------------ | ---------: | -------: |
| Website E-commerce       | Aurora Studio | Em andamento | 65% manual | R$ 7.200 |
| Plataforma Institucional | North Labs    | Planejamento | 25% manual | R$ 4.800 |
| Redesign de Marca        | Pixel House   | Em andamento | 80% manual | R$ 3.900 |

Foram criadas 18 tasks realistas. O projeto principal possui 10: duas a fazer,
duas em andamento e seis concluídas, com prioridades baixa, média, alta e urgente.
Tasks públicas e privadas foram distribuídas entre os projetos. As três colunas
do Kanban principal estão preenchidas.

As 12 entradas de tempo somam **28 horas nos últimos 30 dias**, distribuídas
entre os três projetos e descritas por atividade. O financeiro possui cinco
cobranças:

- Total previsto: R$ 9.700.
- Pago: R$ 4.500.
- Pendente, incluindo vencido: R$ 5.200.
- Vencido: R$ 1.200.

O projeto Website E-commerce possui cinco etapas: Planejamento e Design concluídas,
Desenvolvimento em andamento, Revisão interna pendente e privada, e Entrega
pendente. Quatro etapas são públicas.

Foi criado um PortalLink local válido por 90 dias. A verificação automatizada e
visual confirmou que o Portal mostra projeto, 65% de progresso, quatro etapas
públicas e somente tasks compartilhadas. Não exibe budget, financeiro, horas,
proprietário, e-mail, tasks privadas nem a etapa Revisão interna.

O script de criação foi temporário e não integra o repositório. A conta demo
permanece apenas no PostgreSQL local para permitir novas demonstrações.

## Screenshots reais

Todas as imagens foram capturadas diretamente do DevFlow em um contexto isolado
do Chrome, sem DevTools, barra do navegador, modais, cursor, URL, token ou ID.
Formato WebP, qualidade 92, proporção 8:5.

| Arquivo                                          | Tela                        |   Resolução |    Peso |
| ------------------------------------------------ | --------------------------- | ----------: | ------: |
| `frontend/public/images/devflow-dashboard.webp`  | Dashboard                   | 1600 × 1000 | 70,2 kB |
| `frontend/public/images/devflow-kanban.webp`     | Kanban do projeto principal | 1600 × 1000 | 67,4 kB |
| `frontend/public/images/devflow-financeiro.webp` | Financeiro                  | 1600 × 1000 | 65,5 kB |
| `frontend/public/images/devflow-portal.webp`     | Portal público              | 1600 × 1000 | 38,4 kB |

As capturas administrativas mostram apenas a persona e o e-mail fictícios da
conta demo. A captura do Portal não contém credencial, URL ou informação interna.

## Landing e direção visual

A identidade existente foi preservada: Inter local, fundo preto/cinza, azul
pontual, bordas discretas, foco visível e movimento reduzido. A narrativa visual
usa uma moldura consistente e alterna texto com tela real. Não houve inspiração
externa, imagem inventada ou asset de terceiros.

Ordem final:

1. Navbar pública.
2. Hero com o Dashboard real.
3. Seis recursos principais.
4. Como funciona em cinco passos.
5. Kanban — execução do trabalho.
6. Financeiro — controle de cobranças.
7. Portal do cliente — comunicação e transparência.
8. Organização centralizada.
9. CTA final.
10. Footer.

O Hero mantém headline, descrição e CTAs. O placeholder foi substituído pelo
Dashboard real e a frase passou a ser “Do cliente à entrega, tudo conectado.”

As novas seções usam os títulos “Veja seu trabalho avançar.” e “Projetos e
financeiro no mesmo lugar.” A seção do Portal mantém sua mensagem e agora mostra
a experiência pública real. O fluxo Cliente → Projeto → Tasks → Horas → Financeiro
→ Portal ganhou caixas e uma linha conectora no desktop; no mobile permanece uma
grade simples.

Em 320, 360, 390 e 430 px, texto sempre aparece antes da imagem, as molduras ocupam
a largura disponível e o espaçamento vertical foi mantido compacto. Em desktop,
Kanban e Portal usam texto à esquerda; Financeiro alterna a imagem para a esquerda.

## Performance e bundle

Todas as imagens possuem `width="1600"` e `height="1000"`, reservando a proporção
antes do download. O Dashboard, visível no Hero, usa prioridade alta e não usa
lazy loading. Kanban, Financeiro e Portal usam `loading="lazy"` e `decoding="async"`.
O teste do navegador confirmou que somente o Dashboard é solicitado inicialmente.

Comparação com o build da Landing anterior a esta atualização:

| Artefato                 |  Antes raw / gzip | Depois raw / gzip |
| ------------------------ | ----------------: | ----------------: |
| Entry principal          | 264,85 / 83,92 kB | 264,85 / 83,92 kB |
| Chunk da Landing         |   10,90 / 3,31 kB |   12,51 / 3,52 kB |
| CSS exclusivo da Landing |   10,50 / 2,28 kB |   10,36 / 2,34 kB |

O entry inicial não cresceu. O chunk da Landing aumentou cerca de 1,61 kB raw e
0,21 kB gzip pelas novas seções. Nenhum módulo administrativo, Kanban, financeiro
ou dnd-kit é importado pela Landing; ela carrega somente as imagens estáticas.

## Acessibilidade, SEO e privacidade

As quatro imagens têm textos alternativos específicos. Landmarks, H1 único,
hierarquia de headings, skip link, foco, teclado, menu mobile, contraste e
`prefers-reduced-motion` foram preservados. As molduras usam `figure`; rótulos
decorativos e ícones não duplicam a leitura das imagens.

Título, meta description, viewport, `index, follow`, `og:title`, `og:description`
e `og:type` permanecem inalterados. Nenhuma screenshot foi usada como `og:image`:
as capturas têm proporção 8:5, enquanto uma imagem social dedicada deve ter
preferencialmente 1200 × 630. O Dashboard é a melhor base futura, após composição
específica para essa proporção.

O Portal continua usando `portal.html`, `noindex, nofollow`, `no-referrer` e os
headers de privacidade existentes. O token bruto permaneceu somente em arquivo
temporário privado durante a captura e nunca foi salvo em `frontend/public`.

## Arquivos

Assets criados:

- `frontend/public/images/devflow-dashboard.webp`.
- `frontend/public/images/devflow-kanban.webp`.
- `frontend/public/images/devflow-financeiro.webp`.
- `frontend/public/images/devflow-portal.webp`.

Arquivos da Landing atualizados nesta etapa:

- `frontend/src/components/landing/ProductPreview.tsx`.
- `frontend/src/components/landing/LandingSections.tsx`.
- `frontend/src/pages/LandingPage.tsx`.
- `frontend/src/styles/landing.css`.
- `scripts/landing-browser-check.mjs`.
- `README.md`.
- `docs/landing-publica.md`.

Os demais arquivos modificados ou novos no `git status` pertencem à implementação
anterior da Landing e foram preservados.

## Validação

O teste `scripts/landing-browser-check.mjs` valida:

- carregamento prioritário do Dashboard e lazy das outras três imagens;
- dimensões e `alt` das quatro capturas;
- ausência de API e módulos administrativos no carregamento público;
- 320, 360, 390, 430, 768, 1024, 1366 e 1440 px sem overflow ou conteúdo cortado;
- teclado, skip link, menu, Escape, anchors e reduced motion;
- CTAs, login, cadastro, reload, nove deep links protegidos e Portal separado;
- ausência de erros de console, exceções e loops.

A captura real também verificou Dashboard, três colunas preenchidas do Kanban,
totais e cinco linhas do Financeiro, privacidade do Portal e ausência de erros no
console. A inspeção visual foi realizada nas quatro screenshots e na Landing em
390 e 1440 px.

Os checks finais são `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run format:check`, `git diff --check` e `npm run test:portal:privacy`. Não há
mudança backend que justifique executar as suítes completas.

Limitações: a conta e o Portal demo expiram ou desaparecem se o banco local for
recriado. A validação visual automatizada foi feita no Chrome, sem auditoria por
leitor de tela e sem Safari/Firefox. Não houve SSR, configuração de hospedagem ou
deploy.

SCREENSHOTS REAIS E LANDING DO DEVFLOW ATUALIZADAS.
NÃO houve avanço para o DEPLOY.
