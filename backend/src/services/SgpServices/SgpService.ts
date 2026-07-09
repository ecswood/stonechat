import axios from "axios";

export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  clienteId: number;
  contratoId: number;
  centralSenha: string;
  telefones: string[];
}

export interface SgpBoleto {
  linkBoleto: string;
  linhaDigitavel: string | null;
  pixCopiaCola: string | null;
  valor: string;
  vencimento: string;
}

export type SgpLiberacaoResultado =
  | { sucesso: true; protocolo: string; dataPromessa: string }
  | { sucesso: false; motivo: "ja_utilizado" | "erro"; mensagem: string };

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
      centralSenha: c.contratoCentralSenha ?? "",
      telefones: Array.isArray(c.telefones)
        ? c.telefones.map((t: { contato?: string }) => t.contato ?? "").filter(Boolean)
        : []
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
  } catch {
    return null;
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
    const response = await axios.post(
      `${sgpUrl()}/api/central/promessapagamento/`,
      { cpfcnpj: cpfCnpj, senha: senhaCentral, contrato: contratoId }
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
  } catch {
    return {
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    };
  }
};

export default { consultarCliente, buscarBoleto, liberarConfianca };
