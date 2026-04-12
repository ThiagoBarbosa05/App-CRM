import "express";
import { JwtPayload } from "../lib/jwt";

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}
