# Agente de IA de Atendimento (SNI Telecom) com integração SGP — Design

## Contexto

O StoneChat já tem um mecanismo de chatbot via IA (model `Prompt`, integração
OpenAI em `wbotMessageListener.ts`/`handleOpenAi`) e um padrão comprovado de
"providers" roteirizados por fila (`providers.ts`, hoje com IXC, MK-AUTH e
Asaas) para ações de ISP como 2ª via de boleto e liberação de confiança
("desbloqueio_confianca"). A SNI Telecom usa o **SGP** como sistema de gestão,
que ainda não tem integração no StoneChat (só existe uma integração parcial —
consulta de assinante por login PPPoE — no projeto SNILog).

**Objetivo:** um agente de atendimento via IA, com perfil de provedor de
internet banda larga, que acolhe o cliente pelo WhatsApp, se identifica como
"atendente virtual da SNI Telecom", reconhece o cliente automaticamente nas
conversas seguintes, e resolve sozinho quatro intenções: falar com atendente,
abrir chamado técnico, emitir 2ª via de boleto, e liberação de confiança —
tudo integrado ao SGP.

## Fora de escopo

- Function-calling "de verdade" via API da OpenAI (upgrade de SDK) — usamos o
  mecanismo de frase-gatilho já existente no código, que já resolve o caso de
  uso com bem menos risco e retrabalho.
- Regras de elegibilidade de liberação de confiança calculadas pelo StoneChat
  (dias desde a última liberação, valor de dívida) — o próprio SGP já controla
  isso e devolve essa informação na resposta da API.
- Migração de outros fluxos existentes (IXC/MK-AUTH/Asaas) para o novo padrão.
- Interface de configuração no frontend para as filas/textos do agente (usa a
  tela de Prompt/Queues já existente no StoneChat).

## Fluxo da conversa

1. **Entrada direta pela IA, sem menu numérico**: o `Prompt` fica associado
   diretamente à conexão WhatsApp "8817" (campo `promptId` em `Whatsapp`).
   `handleOpenAi` já prioriza esse prompt sobre o de fila, então toda mensagem
   nova do cliente cai direto na IA.
2. **Boas-vindas + protocolo**: na primeira resposta da IA num ticket, o
   sistema gera um número de protocolo (o próprio `Ticket.id`) e a tag
   "Atendimento IA" é aplicada ao ticket (ver "Registro de atendimento").
   A IA se apresenta: "Olá! Sou o atendente virtual da SNI Telecom. Seu
   protocolo é #<id>."
3. **Identificação**: se `Contact.cpfCnpj` estiver vazio, a IA pede o CPF/CNPJ
   antes de prosseguir com qualquer ação que dependa do SGP. Se já estiver
   preenchido (conversa anterior já identificou o cliente), pula direto para
   "como posso te ajudar?".
4. **Reconhecimento de intenção**: a IA interpreta livremente o pedido do
   cliente (não é menu fixo) e decide qual das 4 ações executar, sinalizando
   por frase-gatilho no texto da resposta.
5. **Execução determinística**: o código (não a IA) executa a ação de fato,
   chamando o SGP ou transferindo a fila. A IA nunca inventa valores de
   boleto nem decide sozinha se uma liberação foi bem-sucedida — ela só lê o
   resultado que o código devolve pra formular a resposta final ao cliente.
6. **Encerramento**: ao concluir uma ação de autosserviço (boleto entregue,
   liberação concedida), a IA agradece, reforça o protocolo, e o ticket é
   fechado (`status: closed`). Nas transferências (atendente/técnico/
   financeiro), o ticket muda de fila e sai do controle da IA.

## As 4 ações

| Intenção do cliente | Frase-gatilho na resposta da IA | Execução determinística |
|---|---|---|
| Falar com atendente | `Ação: Transferir para Atendimento` | Transfere o ticket para a fila **Atendimento** |
| Atendimento técnico | `Ação: Transferir para Técnico` | Transfere o ticket para a fila **Técnico** |
| 2ª via de boleto | `Ação: Buscar Boleto` | Consulta o SGP pelo CPF/CNPJ já identificado, envia boleto (link + linha digitável) e PIX copia-e-cola, agradece e fecha o ticket |
| Liberação de confiança | `Ação: Liberar Confiança` | Chama o endpoint de liberação do SGP. Se bem-sucedido, confirma e fecha o ticket. Se o SGP indicar que o cliente já usou a liberação antes e não cumpriu o acordo, a IA informa isso ao cliente e **transfere para a fila Financeiro** |

O mecanismo de frase-gatilho reaproveita exatamente o padrão que já existe
hoje (`"Ação: Transferir para o setor de atendimento"` em `handleOpenAi`),
generalizado para as 4 frases acima. O texto do gatilho é removido da
mensagem antes de ser enviada ao cliente — ele nunca vê essas frases.

## Registro de atendimento por IA

- **Tag "Atendimento IA"**: aplicada automaticamente ao ticket assim que a IA
  responde a primeira mensagem (usa o model `Tag`/`TicketTag` já existente no
  StoneChat). Fica visível e filtrável por qualquer atendente humano depois,
  mesmo que o ticket seja transferido para outra fila.
- **Protocolo**: `Ticket.id`, comunicado ao cliente na abertura e no
  fechamento do atendimento. Não requer tabela ou contador novo.

## Identificação persistente (CPF/CNPJ)

Novo campo `cpfCnpj` (string, nullable) no model `Contact`, com migration
correspondente. Populado a partir da primeira consulta bem-sucedida ao SGP.
Nas conversas seguintes do mesmo número de WhatsApp, o system prompt da IA
recebe o CPF já conhecido como contexto, evitando perguntar de novo.

## Integração SGP (novo serviço no backend do StoneChat)

Hoje o SGP só está integrado no SNILog (`backend/src/sgp/sgp.service.ts`),
com um único endpoint (`POST /api/ura/consultacliente/`, busca por login
PPPoE). O StoneChat precisa de um `SgpService` próprio
(`backend/src/services/SgpServices/SgpService.ts`) com três operações:

1. **Consulta por CPF/CNPJ** — identifica o cliente e retorna dados do
   contrato/situação.
2. **Segunda via de boleto/PIX** — busca a fatura em aberto mais recente
   (link do boleto, linha digitável, PIX copia-e-cola).
3. **Liberação de confiança** — solicita o desbloqueio; a resposta deve
   indicar sucesso, ou o motivo de recusa (incluindo o caso "já usado e não
   cumprido", que dispara a transferência para Financeiro).

Via pesquisa pública identificamos como prováveis os endpoints
`GET /api/ura/clientes/`, `GET /api/ura/fatura2via/` e `GET /api/ura/titulos/`
(mesma família do `consultacliente` já usado no SNILog, autenticação
token+app). **O endpoint e o formato exato de resposta da liberação de
confiança não foram confirmados** — isso é o primeiro passo do plano de
implementação: validar contra a documentação/suporte do SGP antes de
codar os handlers, usando o token já configurado (`SGP_TOKEN`).

Credenciais (`SGP_URL`, `SGP_TOKEN`) via variáveis de ambiente, seguindo o
mesmo padrão do SNILog — nunca hardcoded.

## Filas necessárias

Nenhuma fila existe hoje no StoneChat (`Queues` está vazio). Serão criadas
três: **Atendimento**, **Técnico**, **Financeiro** — cadastradas via tela de
administração do próprio StoneChat (Queues & Chatbot), não via migration/seed,
para que o Edison possa ajustar nome/cor/horário livremente depois.

## Tratamento de erros

- Falha de rede/timeout ao chamar o SGP: a IA informa que não conseguiu
  consultar no momento e transfere para a fila **Atendimento** (não deixa o
  cliente sem resposta).
- CPF/CNPJ inválido (formato): a IA pede para o cliente digitar novamente,
  sem transferir.
- CPF/CNPJ válido mas não encontrado no SGP: a IA informa que não localizou
  o cadastro e transfere para **Atendimento**.

## Testes

- Testes unitários (padrão TDD já usado no projeto, ex.
  `ResolveContactNumber.spec.ts`) para: parsing da frase-gatilho e
  despacho de ação; `SgpService` (mockando `fetch`/`axios`); persistência do
  CPF no `Contact`.
- Validação end-to-end manual (via Chromium real, como já fizemos na
  investigação do bug de entrega) simulando os 4 fluxos com dados de teste
  reais do SGP antes de liberar em produção.

## Riscos / itens a verificar durante a implementação

1. Endpoint e schema exatos de liberação de confiança no SGP — confirmar
   antes de codar (ver seção "Integração SGP").
2. Confirmar se a busca de boleto por CPF retorna diretamente PDF/link, ou
   se é preciso montar a URL do portal do assinante (como o fluxo existente
   do MK-AUTH faz via Puppeteer, gerando PDF a partir de uma página HTML).
3. Rate limit / custo de tokens OpenAI — o `Prompt` já tem `maxTokens`/
   `maxMessages` configuráveis; ajustar conforme uso real após ir ao ar.
