import { Router } from "express";
import { apiKeyAuth } from "../../middleware/api-key-auth";
import interactionsV1 from "./interactions";
import webhookV1 from "./webhook";
import customersV1 from "./customers";

const router = Router();

// All v1 routes require API key authentication
router.use("/v1", apiKeyAuth);
router.use("/v1/interactions", interactionsV1);
router.use("/v1/webhook", webhookV1);
router.use("/v1/customers", customersV1);

export default router;
