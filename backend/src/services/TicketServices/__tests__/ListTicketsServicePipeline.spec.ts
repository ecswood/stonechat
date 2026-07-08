jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

// eslint-disable-next-line import/first
import { Op } from "sequelize";
// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import ListTicketsServicePipeline from "../ListTicketsServicePipeline";

describe("ListTicketsServicePipeline", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca IA sem filtro de setor, Aguardando filtrado pelas filas do operador comum, e Atendendo global", async () => {
    (Ticket.findAll as jest.Mock)
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const result = await ListTicketsServicePipeline({
      companyId: 1,
      profile: "user",
      queueIds: [2]
    });

    expect(result).toEqual({
      ia: [{ id: 1 }],
      aguardando: [{ id: 2 }],
      atendendo: [{ id: 3 }]
    });

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { companyId: 1, status: "pending", queueId: null, userId: null }
      })
    );

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          companyId: 1,
          status: "pending",
          queueId: { [Op.and]: [{ [Op.ne]: null }, { [Op.in]: [2] }] },
          userId: null
        }
      })
    );

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: { companyId: 1, status: "open", userId: { [Op.ne]: null } }
      })
    );
  });

  it("não filtra Aguardando por setor quando o perfil é admin", async () => {
    (Ticket.findAll as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await ListTicketsServicePipeline({ companyId: 1, profile: "admin", queueIds: [] });

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          companyId: 1,
          status: "pending",
          queueId: { [Op.ne]: null },
          userId: null
        }
      })
    );
  });
});
