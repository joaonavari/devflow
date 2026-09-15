import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RegisterInput } from '../validators/auth.schemas.js';
import { AuthError, unauthorized } from './auth-error.js';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshSessionId,
  SESSION_TTL_MS,
  verifyAccessToken,
} from './auth-tokens.js';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  timezone: true,
} satisfies Prisma.UserSelect;
// Unknown accounts still perform a cost-12 comparison to reduce timing disclosure.
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);

async function newSession(userId: string) {
  const id = randomUUID();
  const refreshToken = createRefreshToken(id);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const accessToken = await createAccessToken(userId, id);
  return { id, refreshToken, expiresAt, accessToken };
}

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const userId = randomUUID();
  const tokens = await newSession(userId);
  try {
    const user = await database.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        timezone: input.timezone,
        passwordHash,
        sessions: {
          create: {
            id: tokens.id,
            refreshTokenHash: hashRefreshToken(tokens.refreshToken),
            expiresAt: tokens.expiresAt,
          },
        },
      },
      select: publicUserSelect,
    });
    return { user, ...tokens };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthError(
        409,
        'REGISTRATION_FAILED',
        'Não foi possível criar a conta com os dados informados. Tente entrar ou revise os dados.',
      );
    }
    throw error;
  }
}

export async function login(email: string, password: string) {
  const account = await database.user.findUnique({
    where: { email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  const matches = await bcrypt.compare(password, account?.passwordHash ?? (await dummyHash));
  if (!account || !matches)
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos.');
  const tokens = await newSession(account.id);
  await database.authSession.create({
    data: {
      id: tokens.id,
      userId: account.id,
      refreshTokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    },
  });
  const user = {
    id: account.id,
    name: account.name,
    email: account.email,
    timezone: account.timezone,
  };
  return { user, ...tokens };
}

export async function refresh(token: string | undefined) {
  const id = refreshSessionId(token);
  if (!token) throw unauthorized();
  const session = await database.authSession.findFirst({
    where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: publicUserSelect } },
  });
  if (!session) throw unauthorized();
  const refreshToken = createRefreshToken(id);
  const accessToken = await createAccessToken(session.userId, id);
  // Compare-and-swap: only one request can consume a given token, even across processes.
  const rotated = await database.authSession.updateMany({
    where: {
      id,
      refreshTokenHash: hashRefreshToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { refreshTokenHash: hashRefreshToken(refreshToken) },
  });
  if (rotated.count !== 1) {
    // Do not clear cookies: a concurrent winner may already have installed fresh ones.
    throw new AuthError(
      409,
      'REFRESH_CONFLICT',
      'Não foi possível renovar a sessão. Verifique a sessão novamente.',
    );
  }
  return { user: session.user, refreshToken, accessToken, expiresAt: session.expiresAt };
}

export async function authenticatedUser(accessToken: string | undefined) {
  const claims = await verifyAccessToken(accessToken);
  const session = await database.authSession.findFirst({
    where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, user: { select: publicUserSelect } },
  });
  if (!session) throw unauthorized();
  return session;
}

export async function logout(refreshToken: string | undefined, accessToken: string | undefined) {
  // A valid access token permits logout even if another tab has just rotated refresh.
  let claims;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }
  if (claims) {
    await database.authSession.updateMany({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }
  if (!refreshToken) return;
  let id: string;
  try {
    id = refreshSessionId(refreshToken);
  } catch {
    return;
  }
  await database.authSession.updateMany({
    where: { id, refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
