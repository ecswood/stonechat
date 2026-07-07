import axios from "axios";

export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  clienteId: number;
  contratoId: number;
  // TODO: Field name not yet verified against real SGP response (unlike other fields
  // which are cross-validated against SNILog's working consultacliente integration).
  // Needs confirmation with real test CPF before Tasks 4/7/8 rely on it, or at latest during Task 13 QA.
  bloqueado: boolean;
}

const sgpUrl = (): string => process.env.SGP_URL || "";
const sgpToken = (): string => process.env.SGP_TOKEN || "";

const consultarCliente = async (
  cpfCnpj: string
): Promise<SgpCliente | null> => {
  try {
    const response = await axios.post(`${sgpUrl()}/api/ura/consultacliente/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });

    const contratos = response.data?.contratos ?? [];
    if (contratos.length === 0) return null;

    const c = contratos[0];
    return {
      nome: c.razaoSocial ?? "",
      cpfCnpj: c.cpfCnpj ?? "",
      contratoStatus: c.contratoStatusDisplay ?? "",
      clienteId: c.clienteId ?? 0,
      contratoId: c.contratoId ?? 0,
      // TODO: bloqueado field name unverified against real SGP API response. See interface comment.
      bloqueado: c.bloqueado === true || c.bloqueado === "sim"
    };
  } catch {
    return null;
  }
};

export default { consultarCliente };
