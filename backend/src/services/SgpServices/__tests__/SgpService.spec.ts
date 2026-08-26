jest.mock("axios");
jest.mock("../../../helpers/SgpOutageAlert", () => ({
  __esModule: true,
  notifySgpOutage: jest.fn().mockResolvedValue(undefined)
}));

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import SgpService from "../SgpService";
// eslint-disable-next-line import/first
import { notifySgpOutage } from "../../../helpers/SgpOutageAlert";

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
            contratoCentralSenha: "09cz5dle",
            telefones: [{ inscricoes: [], tipoContato: "Celular Pessoal", contato: "(43) 98851-5951" }]
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
      centralSenha: "09cz5dle",
      telefones: ["(43) 98851-5951"]
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" },
      { timeout: 8000 }
    );
  });

  it("retorna null quando o SGP não localiza o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "Nenhum contrato localizado", contratos: [] }
    });

    const result = await SgpService.consultarCliente("00000000000");

    expect(result).toBeNull();
  });

  it("propaga o erro quando a chamada falha, em vez de dizer que o cliente não foi encontrado (regressão real: falha de rede/timeout virava null, e o cliente ouvia 'não localizei seu cadastro' mesmo quando o CPF era real e a consulta simplesmente não rodou)", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.consultarCliente("12345678900")).rejects.toThrow(
      "timeout"
    );
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("tenta de novo automaticamente quando a primeira chamada falha, usando o resultado da segunda tentativa", async () => {
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        data: {
          contratos: [
            {
              razaoSocial: "Edison Carlos",
              cpfCnpj: "12345678900",
              contratoStatusDisplay: "Ativo",
              clienteId: 42,
              contratoId: 99,
              contratoCentralSenha: "09cz5dle",
              telefones: []
            }
          ]
        }
      });

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).not.toBeNull();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});

describe("SgpService.consultarClienteCompleto", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna nome/cpf do cliente e todos os contratos/planos (caso real: mesmo CPF com endereços diferentes por contrato)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        contratos: [
          {
            razaoSocial: "EDISON CARLOS DOS SANTOS",
            cpfCnpj: "681.977.569-53",
            clienteId: 1,
            contratoId: 1388,
            contratoStatusDisplay: "Suspenso",
            servico_plano: "RADIO 20MB",
            servico_login: "edisonvilanova",
            endereco_logradouro: "RUA 7 DE SETEMBRO",
            endereco_numero: 422,
            endereco_complemento: "CASA",
            endereco_bairro: "VILA NOVA",
            endereco_cidade: "JOAQUIM TÁVORA",
            endereco_uf: "PR",
            endereco_cep: "86455-000"
          },
          {
            razaoSocial: "EDISON CARLOS DOS SANTOS",
            cpfCnpj: "681.977.569-53",
            contratoId: 1993,
            contratoStatusDisplay: "Ativo",
            planotv: "TELECINE"
          }
        ]
      }
    });

    const result = await SgpService.consultarClienteCompleto("68197756953");

    expect(result).toEqual({
      nome: "EDISON CARLOS DOS SANTOS",
      cpfCnpj: "681.977.569-53",
      clienteId: 1,
      contratos: [
        {
          contratoId: 1388,
          plano: "RADIO 20MB",
          status: "Suspenso",
          endereco: "RUA 7 DE SETEMBRO, 422 - CASA - VILA NOVA - JOAQUIM TÁVORA/PR - 86455-000",
          login: "edisonvilanova"
        },
        {
          contratoId: 1993,
          plano: "TELECINE",
          status: "Ativo",
          endereco: null,
          login: null
        }
      ]
    });
  });

  it("retorna null quando o SGP não localiza nenhum contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { contratos: [] }
    });

    const result = await SgpService.consultarClienteCompleto("00000000000");

    expect(result).toBeNull();
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(
      SgpService.consultarClienteCompleto("12345678900")
    ).rejects.toThrow("timeout");
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

  it("retorna o título em aberto com vencimento mais próximo, não o primeiro da lista (caso real: Fabricio, CPF 48295396900)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paginacao: { offset: 0, limit: 250, parcial: 3, total: 3 },
        titulos: [
          {
            id: 90001,
            clienteContrato: 1879,
            link: "https://snitelecom.sgp.net.br/boleto/futuro-2027/",
            status: "aberto",
            valorCorrigido: 99.9,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2027-03-10"
          },
          {
            id: 90002,
            clienteContrato: 1879,
            link: "https://snitelecom.sgp.net.br/boleto/vencido/",
            status: "aberto",
            valorCorrigido: 50.0,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-06-01"
          },
          {
            id: 90003,
            clienteContrato: 1879,
            link: "https://snitelecom.sgp.net.br/boleto/proximo/",
            status: "aberto",
            valorCorrigido: 60.0,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-07-15"
          }
        ]
      }
    });

    const result = await SgpService.buscarBoleto("48295396900");

    expect(result).toEqual({
      linkBoleto: "https://snitelecom.sgp.net.br/boleto/vencido/",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "50",
      vencimento: "2026-06-01"
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

  it("propaga o erro quando a chamada falha, em vez de dizer que não há fatura em aberto (regressão real 2026-07-17: cliente com 10 títulos em aberto de verdade ouviu 'não encontrei nenhuma fatura em aberto' - a consulta falhou silenciosamente e ninguém percebeu, sem log nenhum)", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.buscarBoleto("05914704979")).rejects.toThrow(
      "timeout"
    );
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});

describe("SgpService.consultarStatusConexao", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna o status de conexão de cada contrato (caso real: 3 contratos, alguns online outros não)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paggination: { total: 2, limit: 100, returned: 2, offset: 0 },
        result: [
          {
            plano: "Fibra - 50MB FIBRA",
            nome: "EDISON CARLOS DOS SANTOS",
            pppoe_login: "joafesta",
            servico_id: 1914,
            online: false,
            radacct: [
              {
                username: "joafesta",
                framedipaddress: "100.73.3.80",
                nasipaddress: "172.16.118.22",
                acctstarttime: "2025-12-06T21:45:27",
                acctstoptime: "2025-12-07T01:44:29",
                acctterminatecause: "Lost-Carrier",
                acctinputoctets: 574680833,
                acctoutputoctets: 704357921
              }
            ]
          },
          {
            plano: "Rádio - RADIO 20MB",
            nome: "EDISON CARLOS DOS SANTOS",
            pppoe_login: "joaobelo",
            servico_id: 1,
            online: true,
            radacct: [
              {
                username: "joaobelo",
                framedipaddress: "172.16.150.52",
                nasipaddress: "172.16.118.24",
                acctstarttime: "2026-08-22T12:20:50",
                acctstoptime: null,
                acctterminatecause: null,
                acctinputoctets: 1051104847,
                acctoutputoctets: 889152919
              }
            ]
          }
        ]
      }
    });

    const result = await SgpService.consultarStatusConexao("68197756953");

    expect(result).toEqual([
      {
        servicoId: 1914,
        plano: "Fibra - 50MB FIBRA",
        login: "joafesta",
        online: false,
        ip: "100.73.3.80",
        concentrador: "172.16.118.22",
        inicioSessao: "2025-12-06T21:45:27",
        fimSessao: "2025-12-07T01:44:29",
        motivoDesconexao: "Lost-Carrier",
        trafegoEntrada: 574680833,
        trafegoSaida: 704357921
      },
      {
        servicoId: 1,
        plano: "Rádio - RADIO 20MB",
        login: "joaobelo",
        online: true,
        ip: "172.16.150.52",
        concentrador: "172.16.118.24",
        inicioSessao: "2026-08-22T12:20:50",
        fimSessao: null,
        motivoDesconexao: null,
        trafegoEntrada: 1051104847,
        trafegoSaida: 889152919
      }
    ]);
  });

  it("retorna lista vazia quando o CPF não tem nenhum contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { paggination: { total: 0, limit: 100, returned: 0, offset: 0 }, result: [] }
    });

    const result = await SgpService.consultarStatusConexao("00000000000");

    expect(result).toEqual([]);
  });

  it("retorna campos nulos quando o contrato nunca teve sessão registrada", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        result: [
          {
            plano: "Rádio - RADIO 20MB",
            pppoe_login: "semSessao",
            servico_id: 42,
            online: false,
            radacct: []
          }
        ]
      }
    });

    const result = await SgpService.consultarStatusConexao("11111111111");

    expect(result).toEqual([
      {
        servicoId: 42,
        plano: "Rádio - RADIO 20MB",
        login: "semSessao",
        online: false,
        ip: null,
        concentrador: null,
        inicioSessao: null,
        fimSessao: null,
        motivoDesconexao: null,
        trafegoEntrada: null,
        trafegoSaida: null
      }
    ]);
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(
      SgpService.consultarStatusConexao("12345678900")
    ).rejects.toThrow("timeout");
  });
});

describe("SgpService.listarBoletosAbertos", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna todos os títulos em aberto, ordenados por vencimento (diferente de buscarBoleto, que devolve só o mais próximo)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        titulos: [
          {
            id: 90001,
            link: "https://snitelecom.sgp.net.br/boleto/futuro/",
            status: "aberto",
            valorCorrigido: 99.9,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2027-03-10"
          },
          {
            id: 90002,
            link: "https://snitelecom.sgp.net.br/boleto/vencido/",
            status: "aberto",
            valorCorrigido: 50.0,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-06-01"
          },
          {
            id: 90003,
            link: "https://snitelecom.sgp.net.br/boleto/cancelado/",
            status: "cancelado",
            valorCorrigido: 10.0,
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-01-01"
          }
        ]
      }
    });

    const result = await SgpService.listarBoletosAbertos("68197756953");

    expect(result).toEqual([
      {
        linkBoleto: "https://snitelecom.sgp.net.br/boleto/vencido/",
        linhaDigitavel: null,
        pixCopiaCola: null,
        valor: "50",
        vencimento: "2026-06-01"
      },
      {
        linkBoleto: "https://snitelecom.sgp.net.br/boleto/futuro/",
        linhaDigitavel: null,
        pixCopiaCola: null,
        valor: "99.9",
        vencimento: "2027-03-10"
      }
    ]);
  });

  it("retorna lista vazia quando não há nenhum título em aberto", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { titulos: [] }
    });

    const result = await SgpService.listarBoletosAbertos("00000000000");

    expect(result).toEqual([]);
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(
      SgpService.listarBoletosAbertos("12345678900")
    ).rejects.toThrow("timeout");
  });
});

describe("SgpService.liberarConfianca", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna sucesso com protocolo e data da promessa quando liberado (status 1, caso real)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 1,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        protocolo: "260707144900",
        liberado: true,
        data_promessa: "2026-07-08",
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: "Liberação via Central App -\n   Serviço ID: 1876, Login: edisonsni\n   Motivo: Promessa de Pagamento\n   "
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/promessapagamento/",
      { cpfcnpj: "68197756953", senha: "09cz5dle", contrato: 1879 },
      { timeout: 8000 }
    );
  });

  it("retorna motivo 'ja_utilizado' quando status é 2 (caso real: limite atingido)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 2,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        liberado: false,
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "ja_utilizado",
      mensagem: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
    });
  });

  it("retorna motivo 'erro' quando status é 0 (caso real: sem bloqueio ativo, nada a liberar)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 0,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        liberado: false,
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: ""
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    });
  });

  it("retorna motivo 'erro' pra falha de rede/timeout", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});

describe("SgpService.abrirOs", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna os dados da OS criada (caso real de produção, testado ao vivo em 2026-08-26 - resposta sem prefixo os_)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 0,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        protocolo: "260826113900",
        ocorrencia_id: 12400,
        cpfcnpj: "681.977.569-53",
        os_id: 2502,
        contrato: 1388,
        msg: ""
      }
    });

    const result = await SgpService.abrirOs(
      1388,
      "Sem internet, cliente relata queda total"
    );

    expect(result).toEqual({
      osId: 2502,
      protocolo: "260826113900",
      status: 0,
      dataCadastro: ""
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/chamado/",
      {
        token: "token-teste",
        app: "StoneChat",
        contrato: 1388,
        conteudo: "Sem internet, cliente relata queda total"
      },
      { timeout: 8000 }
    );
  });

  it("também aceita o formato com prefixo os_ (exemplo da documentação oficial, caso a resposta real mude de novo)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: [
        {
          cliente_id: 500,
          os_status: 0,
          os_protocolo: "200429142914",
          os_conteudo: "Sem internet, cliente relata queda total",
          os_data_cadastro: "2026-08-26T14:29:14.922495",
          os_id: 840,
          contrato_id: 308
        }
      ]
    });

    const result = await SgpService.abrirOs(
      308,
      "Sem internet, cliente relata queda total"
    );

    expect(result).toEqual({
      osId: 840,
      protocolo: "200429142914",
      status: 0,
      dataCadastro: "2026-08-26T14:29:14.922495"
    });
  });

  it("lança erro quando o SGP responde sem os_id (falha silenciosa)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: [{ os_status: null }]
    });

    await expect(SgpService.abrirOs(308, "teste")).rejects.toThrow(
      "SGP não retornou o ID da OS criada"
    );
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.abrirOs(308, "teste")).rejects.toThrow("timeout");
  });

  it("inclui técnico responsável e agendamento no payload quando informados", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: [{ os_id: 841, os_protocolo: "260826100000", os_status: 0, os_data_cadastro: "2026-08-26T10:00:00" }]
    });

    await SgpService.abrirOs(
      308,
      "Instalação agendada",
      "fabricio",
      "2026-08-27 14:00"
    );

    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/chamado/",
      {
        token: "token-teste",
        app: "StoneChat",
        contrato: 308,
        conteudo: "Instalação agendada",
        os_tecnico_responsavel: "fabricio",
        data_hora_agendamento: "2026-08-27 14:00"
      },
      { timeout: 8000 }
    );
  });
});

describe("SgpService.listarTecnicos", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna a lista de técnicos (caso real de produção)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: [
        { id: 11, username: "clau", nome: "Claudineia de Souza Rodrigues" },
        { id: 6, username: "fabricio", nome: "Fabricio Candido Rossato" }
      ]
    });

    const result = await SgpService.listarTecnicos();

    expect(result).toEqual([
      { id: 11, username: "clau", nome: "Claudineia de Souza Rodrigues" },
      { id: 6, username: "fabricio", nome: "Fabricio Candido Rossato" }
    ]);
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/tecnicos/",
      { token: "token-teste", app: "StoneChat" },
      { timeout: 8000 }
    );
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.listarTecnicos()).rejects.toThrow("timeout");
  });
});

describe("SgpService.listarOsAbertas", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna a lista de OS abertas (caso real de produção, testado ao vivo em 2026-08-26)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: [
        {
          os_id: 2503,
          os_protocolo: "260826114000",
          os_status: 0,
          os_status_txt: "Aberta",
          os_conteudo: "Teste 2 - aberta pra checar filtro status_encerrada",
          os_servicoprestado: "",
          os_data_cadastro: "2026-08-26T11:40:00.000000",
          os_data_agendamento: null,
          os_data_finalizacao: null,
          os_tecnico_responsavel: "",
          contrato_id: 1388,
          plano: "RADIO 20MB"
        }
      ]
    });

    const result = await SgpService.listarOsAbertas(1);

    expect(result).toEqual([
      {
        osId: 2503,
        protocolo: "260826114000",
        status: 0,
        statusTexto: "Aberta",
        conteudo: "Teste 2 - aberta pra checar filtro status_encerrada",
        servicoPrestado: null,
        dataCadastro: "2026-08-26T11:40:00.000000",
        dataAgendamento: null,
        dataFinalizacao: null,
        tecnicoResponsavel: null,
        contratoId: 1388,
        plano: "RADIO 20MB"
      }
    ]);
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/os/list/",
      {
        token: "token-teste",
        app: "StoneChat",
        cliente_id: 1,
        status_encerrada: 0
      },
      { timeout: 8000 }
    );
  });

  it("retorna lista vazia quando não há OS aberta", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: [] });

    const result = await SgpService.listarOsAbertas(1);

    expect(result).toEqual([]);
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.listarOsAbertas(1)).rejects.toThrow("timeout");
  });
});

describe("SgpService.fecharOs", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("fecha a OS com serviço prestado e data de finalização (caso real de produção)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "OS alterada com sucesso", os_id: 2502 }
    });

    await SgpService.fecharOs(
      2502,
      "Teste de fechamento - StoneChat dev",
      "2026-08-26 11:45:00"
    );

    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/os/update/id/2502/",
      {
        token: "token-teste",
        app: "StoneChat",
        os_status: 1,
        os_servicoprestado: "Teste de fechamento - StoneChat dev",
        os_data_finalizacao: "2026-08-26 11:45:00"
      },
      { timeout: 8000 }
    );
  });

  it("fecha sem data de finalização quando não informada", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "OS alterada com sucesso", os_id: 2502 }
    });

    await SgpService.fecharOs(2502, "Resolvido no telefone");

    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/os/update/id/2502/",
      {
        token: "token-teste",
        app: "StoneChat",
        os_status: 1,
        os_servicoprestado: "Resolvido no telefone"
      },
      { timeout: 8000 }
    );
  });

  it("lança erro quando o SGP não confirma o os_id fechado", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "erro qualquer" }
    });

    await expect(SgpService.fecharOs(2502, "teste")).rejects.toThrow(
      "SGP não confirmou o fechamento da OS"
    );
  });

  it("propaga o erro quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.fecharOs(2502, "teste")).rejects.toThrow(
      "timeout"
    );
  });
});

describe("SgpService - alerta de indisponibilidade", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";

    // O contador de falhas consecutivas vive no módulo SgpService (não é
    // resetado entre describes deste arquivo - resetModules está desligado
    // no jest.config.js). Os describes anteriores terminam com uma chamada
    // que falha (ex: "retorna motivo 'erro' pra falha de rede/timeout"),
    // então sem isso o contador chegaria aqui já em 1 e os testes abaixo
    // disparariam o alerta um ciclo antes do esperado. Uma chamada de
    // sucesso zera o contador antes de cada teste, sem tocar produção.
    (axios.post as jest.Mock).mockResolvedValueOnce({ data: { contratos: [] } });
    await SgpService.consultarCliente("__reset_contador__");
    jest.clearAllMocks();
  });

  it("dispara o alerta ao acumular 3 falhas seguidas, contando as 3 funções juntas", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.consultarCliente("111")).rejects.toThrow();
    await expect(SgpService.buscarBoleto("222")).rejects.toThrow();
    expect(notifySgpOutage).not.toHaveBeenCalled();

    await SgpService.liberarConfianca("333", "senha", 1);

    expect(notifySgpOutage).toHaveBeenCalledTimes(1);
  });

  it("zera o contador de falhas em qualquer sucesso, evitando disparar o alerta com falhas não-seguidas", async () => {
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));
    await expect(SgpService.consultarCliente("111")).rejects.toThrow();

    (axios.post as jest.Mock).mockResolvedValueOnce({ data: { titulos: [] } });
    await SgpService.buscarBoleto("222");

    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));
    await SgpService.liberarConfianca("333", "senha", 1);

    expect(notifySgpOutage).not.toHaveBeenCalled();
  });

  it("não repete o alerta em falhas subsequentes depois de já ter cruzado 3 seguidas", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.consultarCliente("1")).rejects.toThrow();
    await expect(SgpService.buscarBoleto("2")).rejects.toThrow();
    await SgpService.liberarConfianca("3", "senha", 1);
    await expect(SgpService.consultarCliente("4")).rejects.toThrow();

    expect(notifySgpOutage).toHaveBeenCalledTimes(1);
  });
});
