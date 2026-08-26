jest.mock("../../../models/Setting", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../VerifyCurrentSchedule", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../HolidayServices/VerifyIsHolidayService", () => ({
  __esModule: true,
  default: jest.fn()
}));

import moment from "moment";
import Setting from "../../../models/Setting";
import Queue from "../../../models/Queue";
import VerifyCurrentSchedule from "../VerifyCurrentSchedule";
import VerifyIsHolidayService from "../../HolidayServices/VerifyIsHolidayService";
import VerifyIsOutOfHoursService from "../VerifyIsOutOfHoursService";

describe("VerifyIsOutOfHoursService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (VerifyIsHolidayService as jest.Mock).mockResolvedValue(false);
  });

  it("retorna false quando scheduleType não está configurado", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue(null);

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(false);
  });

  it("retorna false quando scheduleType é 'disabled'", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "disabled" });

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(false);
  });

  it("retorna true quando hoje é feriado, independente do modo configurado", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "company" });
    (VerifyIsHolidayService as jest.Mock).mockResolvedValue(true);

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(true);
    expect(VerifyCurrentSchedule).not.toHaveBeenCalled();
  });

  it("modo 'company': retorna true quando VerifyCurrentSchedule diz que está fora do horário", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "company" });
    (VerifyCurrentSchedule as jest.Mock).mockResolvedValue({
      inActivity: false
    });

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(true);
  });

  it("modo 'company': retorna false quando está dentro do horário", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "company" });
    (VerifyCurrentSchedule as jest.Mock).mockResolvedValue({
      inActivity: true
    });

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(false);
  });

  it("modo 'company': retorna false quando não há horário configurado pro dia (currentSchedule nulo)", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "company" });
    (VerifyCurrentSchedule as jest.Mock).mockResolvedValue(null);

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(false);
  });

  it("modo 'queue': retorna true quando o horário da hora atual está fora da janela da fila", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "queue" });
    (Queue.findOne as jest.Mock).mockResolvedValue({
      outOfHoursMessage: "Estamos fechados",
      schedules: [
        {
          weekdayEn: moment().format("dddd").toLowerCase(),
          startTime: "00:00",
          endTime: "00:01"
        }
      ]
    });

    const result = await VerifyIsOutOfHoursService(1, "Técnico");

    expect(result).toBe(true);
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Técnico", companyId: 1 }
    });
  });

  it("modo 'queue': retorna false quando não há fila com esse nome", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "queue" });
    (Queue.findOne as jest.Mock).mockResolvedValue(null);

    const result = await VerifyIsOutOfHoursService(1, "Técnico");

    expect(result).toBe(false);
  });

  it("modo 'queue': retorna false quando queueName não foi informado", async () => {
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "queue" });

    const result = await VerifyIsOutOfHoursService(1);

    expect(result).toBe(false);
    expect(Queue.findOne).not.toHaveBeenCalled();
  });
});
