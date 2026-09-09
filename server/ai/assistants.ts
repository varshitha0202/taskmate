import { db } from '../db.js';
import { getOrCreateCustomerWallet } from './pointsAndWallet.js';

export interface AssistantMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * AI Customer Support Assistant Query Handler
 */
export function handleCustomerAssistantQuery(params: {
  customerId: string;
  query: string;
}): { reply: string; suggestedActions?: { label: string; action: string; payload?: any }[] } {
  const { customerId, query } = params;
  const q = query.toLowerCase();

  const customer = db.prepare('SELECT * FROM profiles WHERE id = ?').get(customerId) as any;
  if (!customer || customer.role !== 'CUSTOMER') {
    throw new Error('Customer assistant is only available to customer accounts');
  }
  const wallet = getOrCreateCustomerWallet(customerId);

  // 1. Status / ETA inquiry
  if (q.includes('status') || q.includes('eta') || q.includes('where is my agent') || q.includes('active')) {
    const activeTask = db.prepare(`
      SELECT t.*, a.name as agent_name, a.phone as agent_phone 
      FROM tasks t 
      LEFT JOIN profiles a ON t.assigned_agent_id = a.id 
      WHERE t.customer_id = ? AND t.status IN ('MATCHING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS')
      ORDER BY t.created_at DESC LIMIT 1
    `).get(customerId) as any;

    if (!activeTask) {
      return {
        reply: `You currently have no active in-flight tasks. Would you like to post a new task or explore top-rated services nearby?`,
        suggestedActions: [{ label: '+ Post a Task', action: 'CREATE_TASK' }],
      };
    }

    if (activeTask.status === 'MATCHING' || activeTask.status === 'OFFERED') {
      return {
        reply: `Your task "${activeTask.title}" is actively matching with top-rated nearby agents. Our AI allocation engine is evaluating distance, skills, and workload. An agent offer is currently pending.`,
      };
    }

    return {
      reply: `Your active task "${activeTask.title}" is assigned to **${activeTask.agent_name || 'your agent'}** (${activeTask.status === 'IN_PROGRESS' ? '🛵 En route' : 'Accepted'}). Estimated arrival is ~${activeTask.estimated_arrival_minutes || 15} minutes. You can reach your agent at ${activeTask.agent_phone || 'via in-app phone'}.`,
    };
  }

  // 2. Compensation inquiry
  if (q.includes('compensation') || q.includes('refund') || q.includes('credit') || q.includes('wallet') || q.includes('unsuccessful')) {
    return {
      reply: `**TaskMate Fair-Compensation Policy**:
If an agent cannot be assigned to your service request within our dispatch window, you automatically receive:
• **Full Refund** of your budget (if pre-paid) to your Refund Balance.
• **₹50 Inconvenience Service Credit** for your next booking.
• **100 Compensation Points**.

Your current wallet balance:
• Refund Balance: **₹${wallet.refund_balance}**
• Service Credits: **₹${wallet.service_credits}**
• Compensation Points: **${wallet.compensation_points}**
• Reward Points: **${wallet.reward_points}** (${wallet.priority_tier})`,
      suggestedActions: [{ label: 'View Wallet', action: 'VIEW_WALLET' }],
    };
  }

  // 3. Customer Points & Tier inquiry
  if (q.includes('point') || q.includes('tier') || q.includes('reward') || q.includes('priority')) {
    return {
      reply: `You currently have **${wallet.reward_points} Reward Points** and hold the **${wallet.priority_tier}** status!
You earn points by:
• +50 pts for every completed task
• +20 pts on-time bonus
• +15 pts for 5-star ratings and reviews
• +25 pts platform loyalty bonus

Higher priority tiers give your requests higher AI allocation weighting!`,
    };
  }

  // 4. Find agents inquiry
  if (q.includes('find') || q.includes('electrician') || q.includes('repair') || q.includes('delivery') || q.includes('agent')) {
    const agents = db.prepare(`
      SELECT name, rating, skills, verification_status FROM profiles 
      WHERE role = 'AGENT' AND verification_status = 'VERIFIED' AND is_available = 1 
      AND COALESCE(active_task_count, 0) < COALESCE(max_concurrent_tasks, 3)
      ORDER BY rating DESC
      LIMIT 3
    `).all() as any[];

    const agentList = agents.length > 0
      ? agents.map((a) => `• ${a.name} (★${Number(a.rating || 0).toFixed(1)})`).join('\n')
      : 'No verified helpers are available right now.';
    return {
      reply: `Here are verified helpers currently available in your area:\n${agentList}\n\nWould you like me to start a task posting for you?`,
      suggestedActions: [{ label: 'Start Booking', action: 'CREATE_TASK' }],
    };
  }

  // 5. Default assistant guidance
  return {
    reply: `Hello ${customer?.name || 'Rahul'}! I am your AI TaskMate Assistant. I can help you:
• Check task status & agent live ETA
• Explain compensation & your wallet balance
• Explain customer priority points & perks
• Find available verified agents nearby
• Guide you through canceling or rebooking a task

How can I assist you today?`,
  };
}

/**
 * AI Agent Assistant Copilot Query Handler
 */
export function handleAgentAssistantQuery(params: {
  agentId: string;
  query: string;
}): { reply: string; suggestedActions?: { label: string; action: string; payload?: any }[] } {
  const { agentId, query } = params;
  const q = query.toLowerCase();

  const agent = db.prepare('SELECT * FROM profiles WHERE id = ?').get(agentId) as any;
  if (!agent || agent.role !== 'AGENT') {
    throw new Error('Agent assistant is only available to agent accounts');
  }

  // 1. Workload & multi-task check
  if (q.includes('workload') || q.includes('multi') || q.includes('capacity') || q.includes('bundle')) {
    const activeCount = agent.active_task_count || 0;
    const maxCapacity = agent.max_concurrent_tasks || 3;
    const remaining = maxCapacity - activeCount;

    return {
      reply: `**Workload Summary**: You currently have **${activeCount} / ${maxCapacity}** active task(s). You have capacity for **${remaining}** additional compatible task(s). 
When compatible tasks appear along your pickup route, AI will suggest a Multi-Task Bundle offer with extra earnings!`,
      suggestedActions: [{ label: 'View Route Optimizer', action: 'VIEW_ROUTE' }],
    };
  }

  // 2. Earnings inquiry
  if (q.includes('earning') || q.includes('income') || q.includes('revenue') || q.includes('payout')) {
    const completedTasks = db.prepare(`
      SELECT COUNT(*) as count, SUM(budget) as total 
      FROM tasks 
      WHERE assigned_agent_id = ? AND status IN ('COMPLETED', 'CONFIRMED')
    `).get(agentId) as any;

    const total = completedTasks?.total || 0;
    const count = completedTasks?.count || 0;

    return {
      reply: `**Earnings Summary**: You have successfully completed **${count}** tasks for a total earned revenue of **₹${total}**. Payments are automatically credited upon customer confirmation. Keep up the high rating to receive top-tier task offers!`,
    };
  }

  // 3. Verification status inquiry
  if (q.includes('verification') || q.includes('badge') || q.includes('score')) {
    return {
      reply: `**Agent Credential Status**: Your status is **${agent.verification_status}** with an AI Trust Score of **${agent.verification_score || 95}/100**. ${agent.verification_notes || 'All credentials verified.'}`,
    };
  }

  // 4. Nearby task opportunities
  if (q.includes('task') || q.includes('nearby') || q.includes('available')) {
    const openTasks = db.prepare(`
      SELECT title, category, budget, pickup_location 
      FROM tasks 
      WHERE status IN ('POSTED', 'MATCHING', 'REASSIGNING')
      LIMIT 3
    `).all() as any[];

    if (openTasks.length === 0) {
      return {
        reply: `There are currently no unmatched tasks in the public pool. Ensure your Availability toggle is set to **ONLINE** so the assignment engine can offer tasks to you immediately!`,
      };
    }

    const taskList = openTasks.map((t) => `• **${t.title}** (₹${t.budget}, ${t.category})`).join('\n');
    return {
      reply: `Here are available tasks currently in the matching queue:\n${taskList}\n\nThe system evaluates distance, workload, and skills to dispatch offers directly to your dashboard.`,
    };
  }

  // Default agent copilot guidance
  return {
    reply: `Hello ${agent?.name?.split(' ')[0] || 'Agent'}! I am your AI Agent Copilot. I can assist you with:
• Reviewing your workload & multi-task batching opportunities
• Checking your earnings and completed task metrics
• Navigating route stops and travel time estimates
• Checking your verification status & skills profile

What would you like to check?`,
  };
}
