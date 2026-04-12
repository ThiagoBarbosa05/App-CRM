import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!SECRET) {
  throw new Error("JWT_SECRET não está definido nas variáveis de ambiente");
}

export interface JwtPayload {
  userId: string;
  role: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET!, {
    expiresIn: EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET!) as JwtPayload;
}
