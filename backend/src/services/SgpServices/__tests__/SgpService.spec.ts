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
            contratoId: 99
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
      contratoId: 99
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

describe("SgpService.buscarBoleto", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna os dados do boleto quando há título em aberto", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paginacao: { offset: 0, limit: 250, parcial: 2, total: 2 },
        titulos: [
          {
            id: 72554,
            clienteContrato: 1879,
            link: "https://snitelecom.sgp.net.br/boleto/73103-VWI6MBJ6L4/",
            status: "aberto",
            valorCorrigido: 5.0,
            codigoBarras: "99999152900000005000000060000000043600000000",
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-08-05"
          },
          {
            id: 64253,
            clienteContrato: 1,
            link: "https://snitelecom.sgp.net.br/boleto/64802-FE2JC3EN6H/",
            status: "cancelado",
            valorCorrigido: 10.0,
            codigoBarras: "75699140300000010001437401032884700104542001",
            linhaDigitavel: "75691.43741 01032.884700 01045.420013 9 14030000001000",
            codigoPix: "00020101021226950014br.gov.bcb.pix",
            dataVencimento: "2026-04-01"
          }
        ]
      }
    });

    const result = await SgpService.buscarBoleto("68197756953");

    expect(result).toEqual({
      linkBoleto: "https://snitelecom.sgp.net.br/boleto/73103-VWI6MBJ6L4/",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "5",
      vencimento: "2026-08-05"
    });
  });

  it("retorna null quando não há nenhum título em aberto", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paginacao: { offset: 0, limit: 250, parcial: 1, total: 1 },
        titulos: [
          {
            id: 64253,
            clienteContrato: 1,
            link: "https://snitelecom.sgp.net.br/boleto/64802-FE2JC3EN6H/",
            status: "cancelado",
            valorCorrigido: 10.0,
            codigoBarras: "756991...",
            linhaDigitavel: "75691...",
            codigoPix: "",
            dataVencimento: "2026-04-01"
          }
        ]
      }
    });

    const result = await SgpService.buscarBoleto("68197756953");

    expect(result).toBeNull();
  });

  it("retorna null quando o CPF não tem nenhum título", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { paginacao: { offset: 0, limit: 250, parcial: 0, total: 0 }, titulos: [] }
    });

    const result = await SgpService.buscarBoleto("00000000000");

    expect(result).toBeNull();
  });
});
