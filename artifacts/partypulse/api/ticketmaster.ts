import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { latlong, radius = 12, size = 50 } = req.query;
  if (!latlong) {
    return res.status(400).json({ error: 'Missing latlong' });
  }
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key' });
  }
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&latlong=${latlong}&radius=${radius}&unit=miles&size=${size}&sort=date,asc`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}
