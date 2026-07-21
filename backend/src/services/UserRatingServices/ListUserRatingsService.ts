import UserRating from "../../models/UserRating";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import User from "../../models/User";

interface Request {
  companyId: number;
  pageNumber?: string;
}

interface Response {
  ratings: UserRating[];
  count: number;
  hasMore: boolean;
}

const ListUserRatingsService = async ({
  companyId,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: ratings } = await UserRating.findAndCountAll({
    where: { companyId },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id"],
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number"]
          }
        ]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      }
    ]
  });

  const hasMore = count > offset + ratings.length;

  return {
    ratings,
    count,
    hasMore
  };
};

export default ListUserRatingsService;
