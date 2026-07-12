import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { sendVerificationEmail } from '../../lib/mailer';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  TokenPayload,
} from '../../lib/jwt';

const router = Router();
const googleClient = new OAuth2Client(config.google.clientId);

// GET /api/auth/config
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleClientId: config.google.clientId || null,
  });
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate verification token (expires in 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        authProvider: 'EMAIL',
        emailVerified: false,
        verificationToken,
        verificationTokenExpires,
        settings: {
          create: {
            theme: 'dark',
          },
        },
      },
    });

    const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:5173';
    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken, clientUrl);
    } catch (err) {
      console.error('[Auth] Failed to send verification email during registration:', err);
    }

    const payload: TokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Re-send verification email if token is expired or missing
      let token = user.verificationToken;
      let expires = user.verificationTokenExpires;

      if (!token || !expires || new Date() > expires) {
        token = crypto.randomBytes(32).toString('hex');
        expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            verificationToken: token,
            verificationTokenExpires: expires,
          },
        });
      }

      const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:5173';
      try {
        await sendVerificationEmail(user.email, token, clientUrl);
      } catch (err) {
        console.error('[Auth] Failed to resend verification email during login:', err);
      }

      res.status(403).json({
        error: 'Email verification required',
        code: 'EMAIL_UNVERIFIED',
      });
      return;
    }

    const payload: TokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Google credential required' });
      return;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      console.error('[Auth] Google token verification failed:', err);
      res.status(401).json({ error: 'Invalid Google token signature or expired' });
      return;
    }

    if (!payload) {
      res.status(401).json({ error: 'Failed to verify Google token' });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      res.status(400).json({ error: 'Email not found in Google credential' });
      return;
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar: picture,
          googleId,
          authProvider: 'GOOGLE',
          emailVerified: true, // Google accounts are pre-verified
          settings: {
            create: {
              theme: 'dark',
            },
          },
        },
      });
    } else {
      // User exists. Ensure googleId is linked and emailVerified is true.
      const updates: any = { emailVerified: true };
      if (!user.googleId) {
        updates.googleId = googleId;
        updates.avatar = picture || user.avatar;
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
    }

    const tokenPayload: TokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Auth] Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newPayload: TokenPayload = { userId: user.id, email: user.email };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, avatar: true, emailVerified: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      console.warn('[Auth] Access token expired (expected behavior, client will refresh)');
    } else {
      console.error('[Auth] verify error:', error);
    }
    res.status(401).json({ error: 'Invalid token', details: error?.message || 'Unknown error' });
  }
});

// GET /api/auth/verify - Verification link clicked by user
router.get('/verify', async (req: Request, res: Response) => {
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host');
  // Check if we are running locally (host contains localhost or 127.0.0.1)
  const isLocalhost = host && (host.includes('localhost') || host.includes('127.0.0.1'));
  const redirectBase = (host && !isLocalhost)
    ? `${protocol}://${host}`
    : (process.env.CLIENT_URL || config.clientUrl || 'http://localhost:5173');

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.redirect(`${redirectBase}/auth?verified=false&error=missing_token`);
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      res.redirect(`${redirectBase}/auth?verified=false&error=invalid_token`);
      return;
    }

    if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
      res.redirect(`${redirectBase}/auth?verified=false&error=expired_token`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    const payload: TokenPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.redirect(`${redirectBase}/auth?verified=true&accessToken=${accessToken}&refreshToken=${refreshToken}`);
  } catch (error) {
    console.error('[Auth] Verification route error:', error);
    res.redirect(`${redirectBase}/auth?verified=false&error=server_error`);
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'Email is already verified' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpires: expires,
      },
    });

    const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:5173';
    await sendVerificationEmail(user.email, token, clientUrl);

    res.json({ message: 'Verification email resent successfully' });
  } catch (error: any) {
    console.error('[Auth] Resend verification error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend verification email' });
  }
});

export default router;
