import axios from "axios";

export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  clienteId: number;
  contratoId: number;
}

export interface SgpBoleto {
  linkBoleto: string;
  linhaDigitavel: string | null;
  pixCopiaCola: string | null;
  valor: string;
  vencimento: string;
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
      contratoId: c.contratoId ?? 0
    };
  } catch {
    return null;
  }
};

const buscarBoleto = async (cpfCnpj: string): Promise<SgpBoleto | null> => {
  try {
    const response = await axios.post(`${sgpUrl()}/api/ura/titulos/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });

    const titulos = response.data?.titulos ?? [];
    const aberto = titulos.find((t: { status: string }) => t.status === "aberto");
    if (!aberto) return null;

    return {
      linkBoleto: aberto.link ?? "",
      linhaDigitavel: aberto.linhaDigitavel || null,
      pixCopiaCola: aberto.codigoPix || null,
      valor: String(aberto.valorCorrigido ?? ""),
      vencimento: aberto.dataVencimento ?? ""
    };
  } catch {
    return null;
  }
};

export default { consultarCliente, buscarBoleto };
