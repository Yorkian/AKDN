import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  userId: number;
  username: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    (request as any).user = decoded;
  } catch {
    reply.code(401).send({ error: 'Invalid or expired token' });
  }
}
