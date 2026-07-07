jest.mock("axios");

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import SgpService from "../SgpService";

describe("SgpService.consultarCliente", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna os dados do cliente quando o SGP encontra o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        msg: "Contrato(s) Localizado(s)",
        contratos: [
          {
            razaoSocial: "Edison Carlos",
            cpfCnpj: "12345678900",
            contratoStatusDisplay: "Ativo",
            clienteId: 42,
            contratoId: 99,
            bloqueado: false
          }
        ]
      }
    });

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).toEqual({
      nome: "Edison Carlos",
      cpfCnpj: "12345678900",
      contratoStatus: "Ativo",
      clienteId: 42,
      contratoId: 99,
      bloqueado: false
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" }
    );
  });

  it("retorna null quando o SGP não localiza o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "Nenhum contrato localizado", contratos: [] }
    });

    const result = await SgpService.consultarCliente("00000000000");

    expect(result).toBeNull();
  });

  it("retorna null quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).toBeNull();
  });
});
