import { Router } from "express";
import { login, logout, me } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", asyncHandler(me));
authRouter.post("/logout", logout);
