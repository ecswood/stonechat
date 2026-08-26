import Holiday from "../../models/Holiday";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  companyId: number;
}

const ShowHolidayService = async ({
  id,
  companyId
}: Request): Promise<Holiday> => {
  const holiday = await Holiday.findOne({ where: { id, companyId } });

  if (!holiday) {
    throw new AppError("ERR_NO_HOLIDAY_FOUND", 404);
  }

  return holiday;
};

export default ShowHolidayService;
