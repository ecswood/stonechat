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

    return res.json({ vinculado: true, encontrado: true, cliente });
  } catch (err) {
    logger.error(`[SgpController.showCliente] contactId=${contactId}: ${err}`);
    return res.status(502).json({ vinculado: true, erro: true });
  }
};
