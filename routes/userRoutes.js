import express from "express";
import { createUser } from "../controller.js";
import inputValidation from "../controller.js";

const router = express.Router();

//  "localhost:8383/api/users/"
router.post("/", inputValidation, createUser);

export default router;
