import { Request, Response } from "express";

import CreateHolidayService from "../services/HolidayServices/CreateHolidayService";
import ListHolidaysService from "../services/HolidayServices/ListHolidaysService";
import UpdateHolidayService from "../services/HolidayServices/UpdateHolidayService";
import DeleteHolidayService from "../services/HolidayServices/DeleteHolidayService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const holidays = await ListHolidaysService({ companyId });

  return res.status(200).json(holidays);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { date, description, recurrent } = req.body;
  const { companyId } = req.user;

  const holiday = await CreateHolidayService({
    date,
    description,
    recurrent,
    companyId
  });

  return res.status(200).json(holiday);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { holidayId } = req.params;
  const { date, description, recurrent } = req.body;
  const { companyId } = req.user;

  const holiday = await UpdateHolidayService({
    holidayData: { date, description, recurrent },
    id: holidayId,
    companyId
  });

  return res.status(200).json(holiday);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { holidayId } = req.params;
  const { companyId } = req.user;

  await DeleteHolidayService({ id: holidayId, companyId });

  return res.status(200).json({ message: "Holiday deleted" });
};
