import express from "express";
import isAuth from "../middleware/isAuth";

import * as UserRatingController from "../controllers/UserRatingController";

const userRatingRoutes = express.Router();

userRatingRoutes.get("/user-ratings", isAuth, UserRatingController.index);

export default userRatingRoutes;
