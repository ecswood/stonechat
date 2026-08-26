import { Op } from "sequelize";
import Holiday from "../../../models/Holiday";
import VerifyIsHolidayService from "../VerifyIsHolidayService";

jest.mock("../../../models/Holiday");

describe("VerifyIsHolidayService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna true quando existe feriado cadastrado (recorrente ou não) pra hoje", async () => {
    (Holiday.count as jest.Mock).mockResolvedValue(1);

    // 2026-12-25 12:00 UTC cai em 25/12 no horário de Brasília
    const result = await VerifyIsHolidayService(
      1,
      new Date("2026-12-25T12:00:00Z")
    );

    expect(result).toBe(true);
    expect(Holiday.count).toHaveBeenCalledTimes(1);
    const callArgs = (Holiday.count as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.companyId).toBe(1);
  });

  it("retorna false quando não há feriado cadastrado pra hoje", async () => {
    (Holiday.count as jest.Mock).mockResolvedValue(0);

    const result = await VerifyIsHolidayService(
      1,
      new Date("2026-08-26T12:00:00Z")
    );

    expect(result).toBe(false);
  });

  it("monta o filtro de data completa (feriado não recorrente) com zero à esquerda pra data de um dígito (regressão: 05 vira 5 sem padStart)", async () => {
    (Holiday.count as jest.Mock).mockResolvedValue(0);

    // 2026-01-05 12:00 UTC cai em 05/01 no horário de Brasília
    await VerifyIsHolidayService(1, new Date("2026-01-05T12:00:00Z"));

    const callArgs = (Holiday.count as jest.Mock).mock.calls[0][0];
    const orConditions = callArgs.where[Op.or];
    const naoRecorrente = orConditions.find((c: any) => c.recurrent === false);
    expect(naoRecorrente.date).toBe("2026-01-05");
  });
});
