import { Request, Response } from "express";
import ListUserRatingsService from "../services/UserRatingServices/ListUserRatingsService";

type IndexQuery = {
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { ratings, count, hasMore } = await ListUserRatingsService({
    companyId,
    pageNumber
  });

  return res.json({ ratings, count, hasMore });
};
