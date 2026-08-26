import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Holiday from "../../models/Holiday";

interface Request {
  date: string;
  description: string;
  recurrent?: boolean;
  companyId: number;
}

const CreateHolidayService = async ({
  date,
  description,
  recurrent = false,
  companyId
}: Request): Promise<Holiday> => {
  const schema = Yup.object().shape({
    date: Yup.string().required(),
    description: Yup.string().required().min(2)
  });

  try {
    await schema.validate({ date, description });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const holiday = await Holiday.create({
    date,
    description,
    recurrent,
    companyId
  });

  return holiday;
};

export default CreateHolidayService;
