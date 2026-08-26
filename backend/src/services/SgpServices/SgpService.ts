import axios from "axios";
import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";
import { notifySgpOutage } from "../../helpers/SgpOutageAlert";

export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  clienteId: number;
  contratoId: number;
  centralSenha: string;
  telefones: string[];
}

export interface SgpContrato {
  contratoId: number;
  plano: string;
  status: string;
  endereco: string | null;
  login: string | null;
}

export interface SgpClienteCompleto {
  nome: string;
  cpfCnpj: string;
  clienteId: number;
  contratos: SgpContrato[];
}

export interface SgpBoleto {
  linkBoleto: string;
  linhaDigitavel: string | null;
  pixCopiaCola: string | null;
  valor: string;
  vencimento: string;
}

export interface SgpStatusConexao {
  servicoId: number;
  plano: string;
  login: string;
  online: boolean;
  ip: string | null;
  concentrador: string | null;
  inicioSessao: string | null;
  fimSessao: string | null;
  motivoDesconexao: string | null;
  trafegoEntrada: number | null;
  trafegoSaida: number | null;
}

export interface SgpTecnico {
  id: number;
  username: string;
  nome: string;
}

export interface SgpOsAberta {
  osId: number;
  protocolo: string;
  status: number;
  dataCadastro: string;
}

export interface SgpOsResumo {
  osId: number;
  protocolo: string;
  status: number;
  statusTexto: string;
  conteudo: string;
  servicoPrestado: string | null;
  dataCadastro: string;
  dataAgendamento: string | null;
  dataFinalizacao: string | null;
  tecnicoResponsavel: string | null;
  contratoId: number;
  plano: string;
}

export type SgpLiberacaoResultado =
  | { sucesso: true; protocolo: string; dataPromessa: string }
  | { sucesso: false; motivo: "ja_utilizado" | "erro"; mensagem: string };

const sgpUrl = (): string => process.env.SGP_URL || "";
const sgpToken = (): string => process.env.SGP_TOKEN || "";

const SGP_TIMEOUT_MS = 8000;

// Pedido do Edison: falha isolada do SGP (timeout, instabilidade momentânea)
// não deve incomodar o cliente na hora - tenta mais uma vez automaticamente
// antes de desistir. Contador de falhas consecutivas conta as 4 funções
// juntas (consultarCliente, consultarClienteCompleto, buscarBoleto,
// liberarConfianca) e zera em qualquer sucesso - ao cruzar
// SGP_ALERT_THRESHOLD falhas seguidas, avisa o grupo de monitoramento via
// notifySgpOutage (Task 3 deste plano).
const SGP_ALERT_THRESHOLD = 3;
let consecutiveFailures = 0;

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await fn();
      consecutiveFailures = 0;
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  consecutiveFailures += 1;
  if (consecutiveFailures === SGP_ALERT_THRESHOLD) {
    // Fire-and-forget: notifySgpOutage() nunca lança (try/catch interno),
    // mas mesmo assim não bloqueamos a resposta ao cliente que já esperou
    // pelos retries só pra aguardar o alerta ao grupo de monitoramento.
    void notifySgpOutage();
  }
  throw lastError;
};

const consultarCliente = async (
  cpfCnpj: string
): Promise<SgpCliente | null> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/consultacliente/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const contratos = response.data?.contratos ?? [];
    if (contratos.length === 0) return null;

    const c = contratos[0];
    return {
      nome: c.razaoSocial ?? "",
      cpfCnpj: c.cpfCnpj ?? "",
      contratoStatus: c.contratoStatusDisplay ?? "",
      clienteId: c.clienteId ?? 0,
      contratoId: c.contratoId ?? 0,
      centralSenha: c.contratoCentralSenha ?? "",
      telefones: Array.isArray(c.telefones)
        ? c.telefones.map((t: { contato?: string }) => t.contato ?? "").filter(Boolean)
        : []
    };
  } catch (err) {
    // Regressão real: essa falha era engolida em silêncio (nem log, nem
    // Sentry) e virava "null" - o cliente ouvia "não localizei seu
    // cadastro" mesmo quando o CPF era real e a consulta simplesmente
    // falhou (timeout, instabilidade do SGP, etc.). Propagar o erro deixa
    // quem chama tratar isso como uma falha de verdade, não como "não
    // encontrado".
    Sentry.captureException(err);
    logger.error(`[SgpService.consultarCliente] cpfCnpj=${cpfCnpj}: ${err}`);
    throw err;
  }
};

// Cada item de `contratos` no retorno cru do SGP é um contrato/plano
// individual do cliente (internet, TV, ou add-on como Telecine/Deezer) - um
// mesmo CPF/CNPJ pode ter vários. Endereço não é um dado único do cliente:
// contratos diferentes do mesmo CPF podem ter endereços diferentes (caso
// real: um cliente com serviço em duas casas), e contratos de add-on (só
// `planotv`, sem `servico_plano`) não têm campos de endereço - por isso o
// endereço é montado por contrato, não uma vez só pro cliente.
const montarEndereco = (contrato: Record<string, unknown>): string | null => {
  const logradouro = contrato.endereco_logradouro as string | undefined;
  if (!logradouro) return null;

  const numero = (contrato.endereco_numero as string | number | undefined) ?? "s/n";
  const cidade = contrato.endereco_cidade as string | undefined;
  const uf = contrato.endereco_uf as string | undefined;
  const cidadeUf = cidade && uf ? `${cidade}/${uf}` : cidade;

  return [
    `${logradouro}, ${numero}`,
    contrato.endereco_complemento as string | undefined,
    contrato.endereco_bairro as string | undefined,
    cidadeUf,
    contrato.endereco_cep as string | undefined
  ]
    .filter(Boolean)
    .join(" - ");
};

// Usado pelo painel do atendente (ContactDrawer), não pela IA - por isso
// devolve TODOS os contratos/planos do cliente (a IA usa só
// `consultarCliente`, que assume o contrato mais relevante da conversa).
// Não expõe `contratoCentralSenha`: o atendente não precisa da senha do
// Central do Assinante do cliente pra ver o cadastro dele.
const consultarClienteCompleto = async (
  cpfCnpj: string
): Promise<SgpClienteCompleto | null> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/consultacliente/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const contratos = response.data?.contratos ?? [];
    if (contratos.length === 0) return null;

    return {
      nome: contratos[0].razaoSocial ?? "",
      cpfCnpj: contratos[0].cpfCnpj ?? "",
      clienteId: (contratos[0].clienteId as number) ?? 0,
      contratos: contratos.map((c: Record<string, unknown>) => ({
        contratoId: (c.contratoId as number) ?? 0,
        plano:
          (c.servico_plano as string) ||
          (c.planointernet as string) ||
          (c.planotv as string) ||
          "—",
        status: (c.contratoStatusDisplay as string) ?? "",
        endereco: montarEndereco(c),
        login: (c.servico_login as string) || null
      }))
    };
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.consultarClienteCompleto] cpfCnpj=${cpfCnpj}: ${err}`);
    throw err;
  }
};

const buscarBoleto = async (cpfCnpj: string): Promise<SgpBoleto | null> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/titulos/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const titulos = response.data?.titulos ?? [];
    const abertos = titulos
      .filter((t: { status: string }) => t.status === "aberto")
      .sort(
        (
          a: { dataVencimento: string },
          b: { dataVencimento: string }
        ) =>
          new Date(a.dataVencimento).getTime() -
          new Date(b.dataVencimento).getTime()
      );
    const aberto = abertos[0];
    if (!aberto) return null;

    return {
      linkBoleto: aberto.link ?? "",
      linhaDigitavel: aberto.linhaDigitavel || null,
      pixCopiaCola: aberto.codigoPix || null,
      valor: String(aberto.valorCorrigido ?? ""),
      vencimento: aberto.dataVencimento ?? ""
    };
  } catch (err) {
    // Regressão real 2026-07-17: cliente com 10 títulos em aberto de
    // verdade ouviu "não encontrei nenhuma fatura em aberto" porque essa
    // falha (rede/timeout) era engolida em silêncio e virava "null" - sem
    // log nenhum pra investigar depois. Propagar deixa quem chama saber
    // que a consulta falhou, não que o cliente não tem fatura.
    Sentry.captureException(err);
    logger.error(`[SgpService.buscarBoleto] cpfCnpj=${cpfCnpj}: ${err}`);
    throw err;
  }
};

// Usado pelo painel do atendente - diferente de `buscarBoleto` (que a IA usa
// e devolve só o título de vencimento mais próximo), aqui devolve TODOS os
// títulos em aberto, já que o atendente pode precisar ver/mandar mais de um.
// Painel de diagnóstico do atendente - status de conexão em tempo real via
// RADIUS accounting do SGP (endpoint documentado em
// /ws/radius/radacct/list/all/, achado 2026-08-25 vasculhando o catálogo
// Postman oficial - a pesquisa anterior de bloqueio/desbloqueio nunca tinha
// testado esse caminho). Uma chamada só, mesma auth token+app das outras -
// não precisa de SSH/MikroTik nem do Hermes. `last_session=true` traz só a
// sessão mais recente de cada contrato (atual, se online; última, se
// offline), não o histórico completo.
const consultarStatusConexao = async (
  cpfCnpj: string
): Promise<SgpStatusConexao[]> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/ws/radius/radacct/list/all/`,
        {
          token: sgpToken(),
          app: "StoneChat",
          cpfcnpj: cpfCnpj,
          last_session: true
        },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const result = response.data?.result ?? [];
    return result.map((c: Record<string, unknown>) => {
      const sessoes = c.radacct as Record<string, unknown>[] | undefined;
      const sessao = sessoes?.[0];

      return {
        servicoId: (c.servico_id as number) ?? 0,
        plano: (c.plano as string) ?? "",
        login: (c.pppoe_login as string) ?? "",
        online: Boolean(c.online),
        ip: (sessao?.framedipaddress as string) || null,
        concentrador: (sessao?.nasipaddress as string) || null,
        inicioSessao: (sessao?.acctstarttime as string) || null,
        fimSessao: (sessao?.acctstoptime as string) || null,
        motivoDesconexao: (sessao?.acctterminatecause as string) || null,
        trafegoEntrada: (sessao?.acctinputoctets as number) ?? null,
        trafegoSaida: (sessao?.acctoutputoctets as number) ?? null
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.consultarStatusConexao] cpfCnpj=${cpfCnpj}: ${err}`);
    throw err;
  }
};

const listarBoletosAbertos = async (cpfCnpj: string): Promise<SgpBoleto[]> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/titulos/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const titulos = response.data?.titulos ?? [];
    return titulos
      .filter((t: { status: string }) => t.status === "aberto")
      .sort(
        (a: { dataVencimento: string }, b: { dataVencimento: string }) =>
          new Date(a.dataVencimento).getTime() -
          new Date(b.dataVencimento).getTime()
      )
      .map((t: Record<string, unknown>) => ({
        linkBoleto: (t.link as string) ?? "",
        linhaDigitavel: (t.linhaDigitavel as string) || null,
        pixCopiaCola: (t.codigoPix as string) || null,
        valor: String(t.valorCorrigido ?? ""),
        vencimento: (t.dataVencimento as string) ?? ""
      }));
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.listarBoletosAbertos] cpfCnpj=${cpfCnpj}: ${err}`);
    throw err;
  }
};

// Endpoint real: POST /api/central/promessapagamento/ (confirmado ao vivo em produção,
// nos 3 estados possíveis, contra um contrato real). Autenticação DIFERENTE dos outros
// métodos deste arquivo: não usa token/app, usa cpfCnpj + senha do Central do Assinante
// (SgpCliente.centralSenha). `status` é o discriminador confiável da resposta:
//   0 = sem bloqueio ativo, nada a liberar
//   1 = liberado com sucesso (só aqui vêm `protocolo` e `data_promessa`, a data é decidida
//       pelo próprio SGP, não enviamos data no request)
//   2 = já usou o recurso recentemente ("O recurso de promessa de pagamento já atingiu
//       quantidade permitida") — é o caso "já utilizou e não cumpriu" descrito pelo Edison
const liberarConfianca = async (
  cpfCnpj: string,
  senhaCentral: string,
  contratoId: number
): Promise<SgpLiberacaoResultado> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/central/promessapagamento/`,
        { cpfcnpj: cpfCnpj, senha: senhaCentral, contrato: contratoId },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    if (response.data?.status === 1) {
      return {
        sucesso: true,
        protocolo: response.data?.protocolo ?? "",
        dataPromessa: response.data?.data_promessa ?? ""
      };
    }

    if (response.data?.status === 2) {
      return {
        sucesso: false,
        motivo: "ja_utilizado",
        mensagem: response.data?.msg ?? "Você já utilizou esse recurso recentemente."
      };
    }

    return {
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    };
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.liberarConfianca] cpfCnpj=${cpfCnpj}: ${err}`);
    return {
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    };
  }
};

// Endpoint real: POST /api/central/chamado/ (achado 2026-08-26 vasculhando o
// catálogo Postman oficial, pasta "Central Assinante" - mesma auth token/app
// das outras consultas deste arquivo, não usa cpfcnpj+senha aqui). A
// resposta do SGP vem como array com um único objeto (confirmado no exemplo
// oficial da documentação); `os_id` é o campo que confirma que a OS foi
// criada de verdade - se não vier, trata como falha mesmo com HTTP 200.
const abrirOs = async (
  contratoId: number,
  conteudo: string,
  osTecnicoResponsavel?: string,
  dataHoraAgendamento?: string
): Promise<SgpOsAberta> => {
  try {
    const payload: Record<string, unknown> = {
      token: sgpToken(),
      app: "StoneChat",
      contrato: contratoId,
      conteudo
    };
    // Só manda se o atendente escolheu - o SGP aceita a OS sem técnico
    // (fica pra alguém pegar depois) e sem agendamento (atendimento a
    // qualquer momento), então um campo vazio não deve virar string vazia
    // no payload.
    if (osTecnicoResponsavel) {
      payload.os_tecnico_responsavel = osTecnicoResponsavel;
    }
    if (dataHoraAgendamento) {
      payload.data_hora_agendamento = dataHoraAgendamento;
    }

    const response = await withRetry(() =>
      axios.post(`${sgpUrl()}/api/central/chamado/`, payload, {
        timeout: SGP_TIMEOUT_MS
      })
    );

    const os = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!os?.os_id) {
      throw new Error("SGP não retornou o ID da OS criada");
    }

    // Bug real encontrado testando ao vivo (2026-08-26): a resposta de
    // verdade deste endpoint usa campos SEM prefixo `os_` (protocolo,
    // status) - diferente do exemplo da documentação oficial (que motivou a
    // primeira versão deste código) e diferente de /api/os/list/, que usa
    // os_protocolo/os_status normalmente. Aceita os dois formatos.
    return {
      osId: os.os_id,
      protocolo: os.protocolo ?? os.os_protocolo ?? "",
      status: os.status ?? os.os_status ?? 0,
      dataCadastro: os.os_data_cadastro ?? os.data_cadastro ?? ""
    };
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.abrirOs] contratoId=${contratoId}: ${err}`);
    throw err;
  }
};

// Endpoint real: POST /api/ura/tecnicos/ (mesma pasta URA das outras
// consultas token/app). Usado só pra preencher o seletor de técnico
// responsável no diálogo de Abrir OS - lista todo mundo cadastrado como
// técnico no SGP, sem filtro de disponibilidade.
const listarTecnicos = async (): Promise<SgpTecnico[]> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/tecnicos/`,
        { token: sgpToken(), app: "StoneChat" },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const tecnicos = Array.isArray(response.data) ? response.data : [];
    return tecnicos.map((t: Record<string, unknown>) => ({
      id: (t.id as number) ?? 0,
      username: (t.username as string) ?? "",
      nome: (t.nome as string) ?? ""
    }));
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.listarTecnicos] ${err}`);
    throw err;
  }
};

// Endpoint real: POST /api/os/list/ (pasta "Ordem de Serviço"). Achado ao
// vivo (2026-08-26): passar só cliente_id/contrato_id sem `status_encerrada`
// devolve lista vazia sempre, não importa se a OS existe - status_encerrada
// parece ser exigido junto pra esse filtro funcionar de verdade (0 = só
// abertas; 1 = só encerradas; comportamento confirmado testando os dois
// contra o SGP de produção). Lista por cliente_id, não por contrato - o
// atendente quer ver toda OS aberta do cliente, não só de um contrato.
const listarOsAbertas = async (clienteId: number): Promise<SgpOsResumo[]> => {
  try {
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/os/list/`,
        {
          token: sgpToken(),
          app: "StoneChat",
          cliente_id: clienteId,
          status_encerrada: 0
        },
        { timeout: SGP_TIMEOUT_MS }
      )
    );

    const lista = Array.isArray(response.data) ? response.data : [];
    return lista.map((o: Record<string, unknown>) => ({
      osId: (o.os_id as number) ?? 0,
      protocolo: (o.os_protocolo as string) ?? "",
      status: (o.os_status as number) ?? 0,
      statusTexto: (o.os_status_txt as string) ?? "",
      conteudo: (o.os_conteudo as string) ?? "",
      servicoPrestado: (o.os_servicoprestado as string) || null,
      dataCadastro: (o.os_data_cadastro as string) ?? "",
      dataAgendamento: (o.os_data_agendamento as string) || null,
      dataFinalizacao: (o.os_data_finalizacao as string) || null,
      tecnicoResponsavel: (o.os_tecnico_responsavel as string) || null,
      contratoId: (o.contrato_id as number) ?? 0,
      plano: (o.plano as string) ?? ""
    }));
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.listarOsAbertas] clienteId=${clienteId}: ${err}`);
    throw err;
  }
};

// Endpoint real: POST /api/os/update/id/{os_id}/ (mesma pasta). os_status=1
// fecha a OS (valores confirmados na documentação: 0=Aberta, 1=Encerrada,
// 2=Em execução, 3=Pendente). `servicoPrestado` é obrigatório na prática -
// é o "o que foi feito" que o atendente digita; `dataHoraFinalizacao` é
// opcional (formato "AAAA-MM-DD HH:mm:ss") - se omitida, o SGP usa o
// horário do servidor dele.
const fecharOs = async (
  osId: number,
  servicoPrestado: string,
  dataHoraFinalizacao?: string
): Promise<void> => {
  try {
    const payload: Record<string, unknown> = {
      token: sgpToken(),
      app: "StoneChat",
      os_status: 1,
      os_servicoprestado: servicoPrestado
    };
    if (dataHoraFinalizacao) {
      payload.os_data_finalizacao = dataHoraFinalizacao;
    }

    const response = await withRetry(() =>
      axios.post(`${sgpUrl()}/api/os/update/id/${osId}/`, payload, {
        timeout: SGP_TIMEOUT_MS
      })
    );

    if (Number(response.data?.os_id) !== osId) {
      throw new Error("SGP não confirmou o fechamento da OS");
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpService.fecharOs] osId=${osId}: ${err}`);
    throw err;
  }
};

export default {
  consultarCliente,
  consultarClienteCompleto,
  consultarStatusConexao,
  buscarBoleto,
  listarBoletosAbertos,
  listarOsAbertas,
  fecharOs,
  liberarConfianca,
  abrirOs,
  listarTecnicos
};
