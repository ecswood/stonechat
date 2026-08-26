import { Request, Response } from "express";
import ShowContactService from "../services/ContactServices/ShowContactService";
import SgpService from "../services/SgpServices/SgpService";
import { logger } from "../utils/logger";

export const showCliente = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  try {
    const cliente = await SgpService.consultarClienteCompleto(contact.cpfCnpj);

    if (!cliente) {
      return res.json({
        vinculado: true,
        encontrado: false,
        cpfCnpj: contact.cpfCnpj
      });
    }

    // O atendente quer ver só o que está em vigor - contratos
    // cancelados/suspensos só poluem o painel (pedido do Edison, cliente de
    // teste dele tem 9 contratos, a maioria já cancelada de testes antigos).
    const contratosAtivos = cliente.contratos.filter(
      c => c.status.trim().toLowerCase() === "ativo"
    );

    return res.json({
      vinculado: true,
      encontrado: true,
      cliente: { ...cliente, contratos: contratosAtivos }
    });
  } catch (err) {
    logger.error(`[SgpController.showCliente] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

export const statusConexao = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  try {
    const conexoes = await SgpService.consultarStatusConexao(contact.cpfCnpj);
    return res.json({ vinculado: true, conexoes });
  } catch (err) {
    logger.error(`[SgpController.statusConexao] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

export const listBoletos = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  try {
    const boletos = await SgpService.listarBoletosAbertos(contact.cpfCnpj);
    return res.json({ vinculado: true, boletos });
  } catch (err) {
    logger.error(`[SgpController.listBoletos] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

// Desbloqueio por "liberação de confiança" - mesmo mecanismo que a IA já usa
// no WhatsApp (promessa de pagamento no SGP), só que disparado manualmente
// pelo atendente em vez de por uma frase de Ação da IA. Age sobre o
// contrato "principal" do cliente (o primeiro retornado pelo SGP), igual ao
// fluxo da IA - não há seleção de contrato específico aqui.
export const desbloquear = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  try {
    const cliente = await SgpService.consultarCliente(contact.cpfCnpj);

    if (!cliente) {
      return res.json({ vinculado: true, encontrado: false });
    }

    const resultado = await SgpService.liberarConfianca(
      contact.cpfCnpj,
      cliente.centralSenha,
      cliente.contratoId
    );

    return res.json({ vinculado: true, encontrado: true, resultado });
  } catch (err) {
    logger.error(`[SgpController.desbloquear] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

// Abre uma Ordem de Serviço no SGP pro contrato escolhido pelo atendente no
// painel (o cliente pode ter mais de um contrato/plano). `conteudo` é a
// descrição do problema/motivo digitada pelo atendente - o SGP exige e é o
// que aparece pro técnico que for atender a OS.
export const abrirOs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { contratoId, conteudo, tecnicoResponsavel, dataHoraAgendamento } = req.body;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  if (!contratoId || !String(conteudo || "").trim()) {
    return res.status(400).json({ error: "Informe o contrato e a descrição da OS" });
  }

  try {
    const os = await SgpService.abrirOs(
      contratoId,
      String(conteudo).trim(),
      tecnicoResponsavel ? String(tecnicoResponsavel) : undefined,
      dataHoraAgendamento ? String(dataHoraAgendamento) : undefined
    );
    return res.json({ vinculado: true, os });
  } catch (err) {
    logger.error(`[SgpController.abrirOs] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

// Lista os técnicos cadastrados no SGP - usado pra preencher o seletor de
// "técnico responsável" no diálogo de Abrir OS. Não é específico de um
// contato, mas fica aqui junto do resto da integração SGP por simplicidade.
export const listTecnicos = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const tecnicos = await SgpService.listarTecnicos();
    return res.json({ tecnicos });
  } catch (err) {
    logger.error(`[SgpController.listTecnicos] ${err}`);
    return res.status(502).json({ erro: true });
  }
};

// Lista as OS abertas do cliente (todos os contratos, não só um). Sempre
// re-consulta o clienteId a partir do CPF/CNPJ do contato (não confia num
// clienteId vindo do front) - mesmo padrão de todo o resto deste arquivo.
export const listOsAbertas = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  if (!contact.cpfCnpj) {
    return res.json({ vinculado: false });
  }

  try {
    const cliente = await SgpService.consultarClienteCompleto(contact.cpfCnpj);

    if (!cliente) {
      return res.json({ vinculado: true, encontrado: false });
    }

    const osList = await SgpService.listarOsAbertas(cliente.clienteId);
    return res.json({ vinculado: true, encontrado: true, osList });
  } catch (err) {
    logger.error(`[SgpController.listOsAbertas] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};

// Fecha uma OS já existente. `servicoPrestado` é o "o que foi feito" e
// `dataHoraFinalizacao` (opcional) é a data/hora escolhida pelo atendente -
// convertida pro formato "AAAA-MM-DD HH:mm:ss" já no front antes de chegar
// aqui.
export const fecharOs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { osId, servicoPrestado, dataHoraFinalizacao } = req.body;

  if (!osId || !String(servicoPrestado || "").trim()) {
    return res
      .status(400)
      .json({ error: "Informe a OS e o que foi feito no atendimento" });
  }

  try {
    await SgpService.fecharOs(
      Number(osId),
      String(servicoPrestado).trim(),
      dataHoraFinalizacao ? String(dataHoraFinalizacao) : undefined
    );
    return res.json({ sucesso: true });
  } catch (err) {
    logger.error(`[SgpController.fecharOs] osId=${osId}: ${err}`);
    return res.status(502).json({ erro: true });
  }
};
