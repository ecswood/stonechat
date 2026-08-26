import express from "express";
import isAuth from "../middleware/isAuth";

import * as HolidayController from "../controllers/HolidayController";

const holidayRoutes = express.Router();

holidayRoutes.get("/holidays", isAuth, HolidayController.index);

holidayRoutes.post("/holidays", isAuth, HolidayController.store);

holidayRoutes.put("/holidays/:holidayId", isAuth, HolidayController.update);

holidayRoutes.delete("/holidays/:holidayId", isAuth, HolidayController.remove);

export default holidayRoutes;
