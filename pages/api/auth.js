// pages/api/auth.js
// Simple password auth

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'LucyClawBot';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (password === DASHBOARD_PASSWORD) {
    // In production, you'd set a session cookie here
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid password' });
}