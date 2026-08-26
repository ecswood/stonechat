import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Holiday from "../../models/Holiday";
import ShowHolidayService from "./ShowHolidayService";

interface HolidayData {
  date?: string;
  description?: string;
  recurrent?: boolean;
}

interface Request {
  holidayData: HolidayData;
  id: string | number;
  companyId: number;
}

const UpdateHolidayService = async ({
  holidayData,
  id,
  companyId
}: Request): Promise<Holiday> => {
  const holiday = await ShowHolidayService({ id, companyId });

  const schema = Yup.object().shape({
    date: Yup.string().required(),
    description: Yup.string().required().min(2)
  });

  const { date, description, recurrent } = holidayData;

  try {
    await schema.validate({ date, description });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await holiday.update({ date, description, recurrent });
  await holiday.reload();

  return holiday;
};

export default UpdateHolidayService;
