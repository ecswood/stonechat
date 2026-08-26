import Holiday from "../../models/Holiday";

interface Request {
  companyId: number;
}

const ListHolidaysService = async ({
  companyId
}: Request): Promise<Holiday[]> => {
  const holidays = await Holiday.findAll({
    where: { companyId },
    order: [["date", "ASC"]]
  });

  return holidays;
};

export default ListHolidaysService;
