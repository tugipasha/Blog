import express from 'express';
import nodemailer from 'nodemailer';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const isDev = process.argv.includes('--dev') || !existsSync(distDir);
const port = 5173;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25kb' }));
app.use(express.urlencoded({ extended: false, limit: '25kb' }));

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const submissionLog = new Map();
const MAIL_SETTINGS = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: 'aydintolga008@gmail.com',
  pass: 'Tolga2010*',
  to: 'aydintolga008@gmail.com',
  from: 'aydintolga008@gmail.com',
  siteLabel: 'Tolga Aydin Portfolio',
};

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInput(value, maxLength) {
  return String(value ?? '')
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function validatePayload(payload) {
  const data = {
    name: normalizeInput(payload.name, 80),
    email: normalizeInput(payload.email, 120),
    subject: normalizeInput(payload.subject, 120),
    message: normalizeInput(payload.message, 3000),
    company: normalizeInput(payload.company, 120),
  };

  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!data.name || data.name.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }

  if (!data.email || !emailPattern.test(data.email)) {
    errors.email = 'A valid email address is required.';
  }

  if (!data.subject || data.subject.length < 4) {
    errors.subject = 'Subject must be at least 4 characters.';
  }

  if (!data.message || data.message.length < 20) {
    errors.message = 'Message must be at least 20 characters.';
  }

  return { data, errors };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || 'unknown';
}

function isRateLimited(ipAddress) {
  const now = Date.now();
  const attempts = submissionLog.get(ipAddress) || [];
  const recentAttempts = attempts.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);

  if (recentAttempts.length >= RATE_MAX_REQUESTS) {
    submissionLog.set(ipAddress, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  submissionLog.set(ipAddress, recentAttempts);
  return false;
}

function getMailConfig() {
  if (
    !MAIL_SETTINGS.host ||
    !MAIL_SETTINGS.port ||
    !MAIL_SETTINGS.user ||
    !MAIL_SETTINGS.pass ||
    MAIL_SETTINGS.pass === 'REPLACE_WITH_GMAIL_APP_PASSWORD'
  ) {
    return null;
  }

  return {
    host: MAIL_SETTINGS.host,
    port: MAIL_SETTINGS.port,
    secure: MAIL_SETTINGS.secure,
    auth: {
      user: MAIL_SETTINGS.user,
      pass: MAIL_SETTINGS.pass,
    },
    requireTLS: !MAIL_SETTINGS.secure,
  };
}

async function sendContactEmail(data, transportConfig) {
  const to = MAIL_SETTINGS.to;
  const fromAddress = MAIL_SETTINGS.from;
  const siteLabel = MAIL_SETTINGS.siteLabel;
  const transporter = nodemailer.createTransport(transportConfig);

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br />');

  await transporter.sendMail({
    to,
    from: `"${siteLabel}" <${fromAddress}>`,
    replyTo: `"${data.name}" <${data.email}>`,
    subject: `Portfolio inquiry: ${data.subject}`,
    text: [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Subject: ${data.subject}`,
      '',
      'Message:',
      data.message,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #161513;">
        <h2 style="margin-bottom: 16px;">New portfolio contact request</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      </div>
    `,
  });
}

app.get('/api/contact/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(getMailConfig()),
    mode: isDev ? 'development' : 'production',
  });
});

app.post('/api/contact', async (req, res) => {
  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many messages sent from this connection. Please try again later.',
    });
  }

  const { data, errors } = validatePayload(req.body ?? {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'Please review the highlighted fields and try again.',
      fields: errors,
    });
  }

  if (data.company) {
    return res.json({ ok: true });
  }

  const transportConfig = getMailConfig();

  if (!transportConfig) {
    return res.status(503).json({
      error:
        'The contact service is temporarily unavailable. Please try again shortly or email me directly.',
    });
  }

  try {
    await sendContactEmail(data, transportConfig);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[contact] mail send failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({
      error:
        'The contact service is temporarily unavailable. Please try again shortly or email me directly.',
    });
  }
});

if (isDev) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }

    try {
      const templatePath = path.join(rootDir, 'index.html');
      const template = await fs.readFile(templatePath, 'utf8');
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      return next(error);
    }
  });
} else {
  app.use(express.static(distDir));

  app.get('*', async (_req, res, next) => {
    try {
      const html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
      return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      return next(error);
    }
  });
}

app.listen(port, () => {
  console.log(
    `[contact] server running at http://localhost:${port} (${isDev ? 'dev' : 'prod'})`
  );
});
