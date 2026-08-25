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
