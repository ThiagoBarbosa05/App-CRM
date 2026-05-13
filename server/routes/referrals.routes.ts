import { Router } from "express";
import { sendReferralMessageController } from "../controllers/referrals/send-referral-message.controller";
import { deleteReferralController } from "../controllers/referrals/delete-referral.controller";
import { getProgramController } from "../controllers/referrals/get-program.controller";

export const referralsRouter = Router();

referralsRouter.get("/program", getProgramController);
referralsRouter.post("/:referralId/send-message", sendReferralMessageController);
referralsRouter.delete("/:referralId", deleteReferralController);
