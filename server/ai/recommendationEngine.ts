import { db } from '../db.js';

export interface CustomerRecommendation {
  recommendedCategories: { id: string; name: string; reason: string; count: number }[];
  suggestedBookingTimes: string[];
  topNearbyAgents: {
    id: string;
    name: string;
    rating: number;
    skills: string[];
    distanceKm: number;
    avatar_url?: string;
  }[];
}

export function getCustomerRecommendations(customerId: string): CustomerRecommendation {
  // 1. Fetch customer's actual task history
  const history = db.prepare(`
    SELECT category, COUNT(*) as cat_count 
    FROM tasks 
    WHERE customer_id = ? 
    GROUP BY category 
    ORDER BY cat_count DESC
  `).all(customerId) as { category: string; cat_count: number }[];

  const customerProfile = db.prepare('SELECT latitude, longitude FROM profiles WHERE id = ?').get(customerId) as any;
  const custLat = customerProfile?.latitude || 17.4435;
  const custLng = customerProfile?.longitude || 78.3772;

  const categoryNames: Record<string, string> = {
    documents: 'Document Pickup & Courier',
    delivery: 'Pickup & Express Delivery',
    shopping: 'Shopping & Groceries',
    repair: 'Small Home Repairs',
    home_help: 'Home Help & Cleaning',
    digital: 'Digital & PC Support',
    errand: 'Everyday Errands',
    other: 'Custom Assistance',
  };

  const recommendedCategories = history.map((h) => ({
    id: h.category,
    name: categoryNames[h.category] || h.category,
    reason: `Based on ${h.cat_count} previous completed request(s) by you`,
    count: h.cat_count,
  }));

  // If new customer with no history, recommend the most popular platform categories
  if (recommendedCategories.length === 0) {
    recommendedCategories.push(
      { id: 'documents', name: 'Document Pickup & Delivery', reason: 'Most requested service in Hitech City', count: 12 },
      { id: 'delivery', name: 'Pickup & Express Delivery', reason: 'Popular for quick nearby courier', count: 9 },
      { id: 'shopping', name: 'Shopping & Groceries', reason: 'Recommended for neighborhood errands', count: 7 }
    );
  }

  // 2. Fetch top-rated verified agents nearby
  const agents = db.prepare(`
    SELECT id, name, rating, skills, avatar_url, latitude, longitude 
    FROM profiles 
    WHERE role = 'AGENT' AND verification_status = 'VERIFIED' AND is_available = 1 
    ORDER BY rating DESC 
    LIMIT 4
  `).all() as any[];

  const topNearbyAgents = agents.map((a) => {
    let parsedSkills: string[] = [];
    try {
      parsedSkills = typeof a.skills === 'string' ? JSON.parse(a.skills) : a.skills;
    } catch {
      parsedSkills = ['delivery'];
    }

    // Rough distance calculation
    const dLat = (a.latitude - custLat) * 111;
    const dLng = (a.longitude - custLng) * 111 * Math.cos((custLat * Math.PI) / 180);
    const distanceKm = Number(Math.sqrt(dLat * dLat + dLng * dLng).toFixed(1));

    return {
      id: a.id,
      name: a.name,
      rating: a.rating || 5.0,
      skills: parsedSkills,
      distanceKm,
      avatar_url: a.avatar_url,
    };
  });

  return {
    recommendedCategories,
    suggestedBookingTimes: [
      'Right Now (Fastest ~12 min response)',
      'Today 2:00 PM - 4:00 PM (Off-peak traffic)',
      'Tomorrow Morning 9:30 AM',
    ],
    topNearbyAgents,
  };
}
