import Holiday from "../../models/Holiday";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  companyId: number;
}

const DeleteHolidayService = async ({
  id,
  companyId
}: Request): Promise<void> => {
  const holiday = await Holiday.findOne({ where: { id, companyId } });

  if (!holiday) {
    throw new AppError("ERR_NO_HOLIDAY_FOUND", 404);
  }

  await holiday.destroy();
};

export default DeleteHolidayService;
