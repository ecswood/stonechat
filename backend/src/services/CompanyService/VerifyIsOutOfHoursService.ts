import { isNil } from "lodash";
import moment from "moment";
import Setting from "../../models/Setting";
import Queue from "../../models/Queue";
import VerifyCurrentSchedule from "./VerifyCurrentSchedule";
import VerifyIsHolidayService from "../HolidayServices/VerifyIsHolidayService";

// Reaproveita a mesma lógica das checagens de fora-do-expediente que já
// existiam em wbotMessageListener.ts (empresa/fila + feriado), só que como
// função reutilizável - usada pelo fluxo automático de abertura de OS fora
// do horário (ver scheduleTechnicalTransfer). `queueName` só é usado quando
// o modo é "queue" (cada fila com seu próprio horário) - passe o nome da
// fila de destino (ex: "Técnico").
const VerifyIsOutOfHoursService = async (
  companyId: number,
  queueName?: string
): Promise<boolean> => {
  const scheduleType = await Setting.findOne({
    where: { companyId, key: "scheduleType" }
  });

  if (!scheduleType || scheduleType.value === "disabled") return false;

  const isHolidayToday = await VerifyIsHolidayService(companyId);
  if (isHolidayToday) return true;

  if (scheduleType.value === "company") {
    const currentSchedule = await VerifyCurrentSchedule(companyId);
    return !isNil(currentSchedule) && currentSchedule.inActivity === false;
  }

  if (scheduleType.value === "queue" && queueName) {
    const queue = await Queue.findOne({ where: { name: queueName, companyId } });
    if (!queue) return false;

    const { schedules }: any = queue;
    const now = moment();
    const weekday = now.format("dddd").toLowerCase();
    let schedule = null;

    if (Array.isArray(schedules) && schedules.length > 0) {
      schedule = schedules.find(
        (s: any) =>
          s.weekdayEn === weekday &&
          s.startTime !== "" &&
          s.startTime !== null &&
          s.endTime !== "" &&
          s.endTime !== null
      );
    }

    if (queue.outOfHoursMessage && !isNil(schedule)) {
      const startTime = moment(schedule.startTime, "HH:mm");
      const endTime = moment(schedule.endTime, "HH:mm");
      return now.isBefore(startTime) || now.isAfter(endTime);
    }

    return false;
  }

  return false;
};

export default VerifyIsOutOfHoursService;
