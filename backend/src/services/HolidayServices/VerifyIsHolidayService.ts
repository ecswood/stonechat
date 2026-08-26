import { Op, fn, col, where } from "sequelize";
import Holiday from "../../models/Holiday";
import { getBrasiliaParts } from "../../helpers/GreetingByTime";

// Feriado recorrente (Natal, Ano Novo) casa só por mês/dia, ignorando o ano
// cadastrado - assim não precisa recadastrar todo ano. Feriado não
// recorrente (Carnaval, Páscoa, pontos facultativos de ocasião única) casa
// pela data completa.
const VerifyIsHolidayService = async (
  companyId: number,
  date: Date = new Date()
): Promise<boolean> => {
  const { year, month, day } = getBrasiliaParts(date);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const fullDate = `${year}-${mm}-${dd}`;
  const monthDay = `${mm}-${dd}`;

  const count = await Holiday.count({
    where: {
      companyId,
      [Op.or]: [
        {
          [Op.and]: [
            { recurrent: true },
            where(fn("to_char", col("date"), "MM-DD"), monthDay)
          ]
        },
        {
          recurrent: false,
          date: fullDate
        }
      ]
    }
  });

  return count > 0;
};

export default VerifyIsHolidayService;
