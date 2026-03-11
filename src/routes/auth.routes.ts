import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getDb, isFirstRun } from '../db/connection';
import { generateToken, authMiddleware } from '../middleware/auth';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Check if setup is needed
  app.get('/api/auth/status', async () => {
    return { needsSetup: isFirstRun() };
  });

  // Register (first-time only)
  app.post('/api/auth/register', async (request, reply) => {
    if (!isFirstRun()) {
      return reply.code(403).send({ error: 'Admin already registered' });
    }

    const { username, password } = request.body as any;
    if (!username || !password || password.length < 6) {
      return reply.code(400).send({ error: 'Username and password (min 6 chars) required' });
    }

    const db = getDb();
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run(username, hash);

    const user = db.prepare('SELECT id, username FROM admin WHERE username = ?').get(username) as any;
    const token = generateToken({ userId: user.id, username: user.username });

    return { token, username: user.username };
  });

  // Login
  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM admin WHERE username = ?').get(username) as any;
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken({ userId: user.id, username: user.username });
    return { token, username: user.username };
  });

  // Change password
  app.put('/api/auth/password', { preHandler: authMiddleware }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as any;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return reply.code(400).send({ error: 'Current password and new password (min 6 chars) required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM admin WHERE id = ?').get((request as any).user.userId) as any;
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE admin SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
    return { success: true };
  });
}
