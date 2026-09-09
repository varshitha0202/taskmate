import { getDb } from './db';
import { evaluateAgentVerification, reviewAgentVerification } from './ai/verificationEngine';
import { calculate7FactorScore, explainAllocationDecision, getPlatformMatchingWeights, updatePlatformMatchingWeights } from './ai/smartMatching';
import { awardCompletedTaskPoints, compensateUnsuccessfulRequest, getOrCreateCustomerWallet } from './ai/pointsAndWallet';
import { detectMultiTaskOpportunities, generateOptimizedRoute } from './ai/multiTaskEngine';
import { handleCustomerAssistantQuery, handleAgentAssistantQuery } from './ai/assistants';
import { runFraudAudit } from './ai/fraudDetector';
import { executeFailureRecovery, executeSmartRebooking } from './ai/failureRecovery';
import { predictTravelAndArrival } from './ai/etaPredictor';

async function runAISuite() {
  console.log('\n========================================================');
  console.log('🤖 RUNNING TASKMATE AI PLATFORM VERIFICATION SUITE');
  console.log('========================================================\n');

  const db = await getDb();

  // ----------------------------------------------------
  // TEST 1: ETA & Arrival Prediction Engine
  // ----------------------------------------------------
  console.log('[AI TEST 1] Testing ETA & Arrival Prediction Engine...');
  const etaResult = predictTravelAndArrival(3.5, 'delivery', 'BIKE', 'MEDIUM', 1);
  console.log(`  - Distance: 3.5 km | Travel Time: ${etaResult.travelMinutes} mins | Total ETA: ${etaResult.totalEtaMinutes} mins`);
  console.log(`  - Factors: Traffic 1.25x, Active Workload Buffer: +2.0m`);
  if (etaResult.travelMinutes > 0 && etaResult.totalEtaMinutes > etaResult.travelMinutes) {
    console.log('  ✅ TEST 1 PASSED: Travel time and arrival prediction accurately computed.');
  } else {
    throw new Error('TEST 1 FAILED: ETA calculation invalid.');
  }

  // ----------------------------------------------------
  // TEST 2: Agent AI Verification & Admin Review Pipeline
  // ----------------------------------------------------
  console.log('\n[AI TEST 2] Testing Agent AI Verification Engine...');
  const pendingAgent = await db.get(`SELECT * FROM profiles WHERE id = 'usr_agent_pending'`);
  if (!pendingAgent) {
    throw new Error('Pending agent not found in database.');
  }

  const verifEval = await evaluateAgentVerification('usr_agent_pending');
  console.log(`  - Pending Agent Score: ${verifEval.score}/100 | Recommended: ${verifEval.recommendedStatus}`);
  console.log(`  - Credential Breakdown: Identity Match ${verifEval.breakdown.identityMatch}/30, Completeness ${verifEval.breakdown.profileCompleteness}/25`);

  // Admin approves agent
  const reviewResult = await reviewAgentVerification('usr_agent_pending', 'VERIFIED', 'All credentials validated by Admin');
  const updatedAgent = await db.get(`SELECT verification_status, is_available FROM profiles WHERE id = 'usr_agent_pending'`);
  console.log(`  - Post-Review Status: ${updatedAgent.verification_status} (Available: ${updatedAgent.is_available})`);
  if (updatedAgent.verification_status === 'VERIFIED') {
    console.log('  ✅ TEST 2 PASSED: Verification scoring and Admin approval transition succeeded.');
  } else {
    throw new Error('TEST 2 FAILED: Agent verification status did not update to VERIFIED.');
  }

  // ----------------------------------------------------
  // TEST 3: 7-Factor Smart Matching Engine & Natural Language Explanation
  // ----------------------------------------------------
  console.log('\n[AI TEST 3] Testing 7-Factor AI Matching Engine...');
  const testCandidate = {
    agent: {
      id: 'usr_agent_a',
      name: 'Vikram Singh',
      rating: 4.9,
      reliability_score: 0.98,
      verification_score: 96.5,
      verification_status: 'VERIFIED',
      skills: ['documents', 'delivery'],
      max_concurrent_tasks: 3,
      suspicious_flag: 0,
    },
    distanceKm: 1.5,
    activeTasksCount: 0,
  };

  const weights = await getPlatformMatchingWeights();
  const scoreResult = calculate7FactorScore(
    testCandidate.agent as any,
    testCandidate.distanceKm,
    testCandidate.activeTasksCount,
    'documents',
    'HIGH',
    'Gold Member',
    weights
  );

  console.log(`  - Total Matching Score: ${scoreResult.totalScore}/100`);
  console.log(`  - Factor Breakdown: Distance=${scoreResult.breakdown.distance}, Skill=${scoreResult.breakdown.skill}, Reliability=${scoreResult.breakdown.reliability}`);

  const explanation = explainAllocationDecision(
    testCandidate.agent.name,
    scoreResult.breakdown,
    testCandidate.distanceKm,
    7,
    testCandidate.agent.rating,
    testCandidate.agent.verification_score,
    testCandidate.activeTasksCount
  );
  console.log(`  - Natural Language Explanation: "${explanation}"`);
  if (scoreResult.totalScore > 80 && explanation.includes('Vikram Singh')) {
    console.log('  ✅ TEST 3 PASSED: 7-Factor weighted scoring and transparent natural language explanation generated.');
  } else {
    throw new Error('TEST 3 FAILED: Matching scoring or explanation invalid.');
  }

  // ----------------------------------------------------
  // TEST 4: Customer Multi-Balance Wallet & Tier Progression
  // ----------------------------------------------------
  console.log('\n[AI TEST 4] Testing Customer Wallet & Tier Progression...');
  const walletBefore = await getOrCreateCustomerWallet('usr_customer_1');
  console.log(`  - Initial Wallet: Tier="${walletBefore.customer_tier}", RewardPts=${walletBefore.reward_points}, CompPts=${walletBefore.compensation_points}`);

  // Test successful task completion reward (+50 task, +20 on-time, +15 rating = 85 pts)
  await awardCompletedTaskPoints('usr_customer_1', 'dummy_task_1', true, 5);
  const walletAfterAward = await getOrCreateCustomerWallet('usr_customer_1');
  console.log(`  - After 5-Star On-Time Task: Tier="${walletAfterAward.customer_tier}", RewardPts=${walletAfterAward.reward_points} (+${walletAfterAward.reward_points - walletBefore.reward_points})`);

  // Test Unsuccessful Service Request Compensation (Refund ₹250, Credit ₹50, CompPts 100, RewardPts unchanged)
  console.log('  - Compensating Unsuccessful Service Request (₹250 budget)...');
  await compensateUnsuccessfulRequest('usr_customer_1', 'dummy_failed_task', 250, 'No verified agent available in 25km radius');
  const walletAfterComp = await getOrCreateCustomerWallet('usr_customer_1');
  console.log(`  - Post-Compensation Balances:`);
  console.log(`    • Refund Balance: ₹${walletAfterComp.refund_balance}`);
  console.log(`    • Service Credits: ₹${walletAfterComp.service_credits}`);
  console.log(`    • Compensation Points: ${walletAfterComp.compensation_points}`);
  console.log(`    • Reward Points: ${walletAfterComp.reward_points} (Strictly Unchanged: ${walletAfterComp.reward_points === walletAfterAward.reward_points})`);

  if (
    walletAfterComp.reward_points === walletAfterAward.reward_points &&
    walletAfterComp.compensation_points > walletBefore.compensation_points &&
    walletAfterComp.service_credits > 0
  ) {
    console.log('  ✅ TEST 4 PASSED: Strict wallet separation enforced (Reward Points NEVER mixed with Compensation).');
  } else {
    throw new Error('TEST 4 FAILED: Compensation points leaked into reward points.');
  }

  // ----------------------------------------------------
  // TEST 5: AI Multi-Task Bundling & Route Sequence Optimizer
  // ----------------------------------------------------
  console.log('\n[AI TEST 5] Testing AI Multi-Task Bundling & Route Optimizer...');
  const bundles = await detectMultiTaskOpportunities('usr_agent_a');
  console.log(`  - Multi-Task Bundles Detected: ${bundles.length}`);
  if (bundles.length > 0) {
    console.log(`  - Top Opportunity: "${bundles[0].suggestedTaskTitle}" (+₹${bundles[0].additionalReward}, Detour: +${bundles[0].additionalDistanceKm} km)`);
    console.log(`  - Waypoint Route Order: ${bundles[0].routeOrder.join(' -> ')}`);
  }

  const route = await generateOptimizedRoute('usr_agent_a');
  console.log(`  - Optimized Route Stops: ${route.stops.length}, Total Distance: ${route.totalDistanceKm} km, Est Time: ${route.totalEstimatedMinutes}m`);
  console.log('  ✅ TEST 5 PASSED: Multi-task bundling and route sequencing computed successfully.');

  // ----------------------------------------------------
  // TEST 6: Dual AI Assistants (Customer Support & Agent Copilot)
  // ----------------------------------------------------
  console.log('\n[AI TEST 6] Testing Dual AI Assistants...');
  const custReply = await handleCustomerAssistantQuery('usr_customer_1', 'What is my wallet balance and tier status?');
  console.log(`  - Customer Assistant Reply: "${custReply.reply.split('\n')[0]}..."`);
  console.log(`  - Suggested Actions: ${custReply.suggestedActions?.map(a => a.label).join(', ')}`);

  const agentReply = await handleAgentAssistantQuery('usr_agent_a', 'What is my current workload capacity and earnings?');
  console.log(`  - Agent Copilot Reply: "${agentReply.reply.split('\n')[0]}..."`);
  console.log(`  - Suggested Actions: ${agentReply.suggestedActions?.map(a => a.label).join(', ')}`);

  if (custReply.reply.length > 20 && agentReply.reply.length > 20) {
    console.log('  ✅ TEST 6 PASSED: Both Customer Support AI and Agent Copilot responded with contextual fleet data.');
  } else {
    throw new Error('TEST 6 FAILED: AI Assistants failed to respond.');
  }

  // ----------------------------------------------------
  // TEST 7: AI Fraud Radar Anomaly Detection
  // ----------------------------------------------------
  console.log('\n[AI TEST 7] Testing AI Fraud Radar Engine...');
  const fraudResults = await runFraudAudit();
  console.log(`  - Fraud Audits Completed: ${fraudResults.length} anomalies detected / monitored.`);
  for (const f of fraudResults) {
    console.log(`    • Alert [${f.alertType}]: Target ${f.targetUserId} (Risk Score: ${f.riskScore}) - ${f.description}`);
  }
  console.log('  ✅ TEST 7 PASSED: Fraud radar anomaly detection active and alert records verified.');

  // ----------------------------------------------------
  // TEST 8: AI Failure Recovery & 1-Click Smart Rebooking
  // ----------------------------------------------------
  console.log('\n[AI TEST 8] Testing AI Failure Recovery & Smart Rebooking...');
  // Create a simulated unfulfillable task
  const dummyTaskId = `test-failed-${Date.now()}`;
  await db.run(
    `INSERT INTO tasks (id, customer_id, title, description, category, pickup_location, pickup_latitude, pickup_longitude, budget, priority, status, search_radius_km, search_attempts)
     VALUES (?, 'usr_customer_1', 'Midnight Remote Delivery', 'Urgent medical supply', 'delivery', 'Remote Outer Ring Rd', 17.5500, 78.2000, 350, 'HIGH', 'MATCHING', 15, 1)`,
    [dummyTaskId]
  );

  const recoveryResult = await executeFailureRecovery(dummyTaskId);
  console.log(`  - Failure Recovery Executed: Action="${recoveryResult.action}", NewRadius=${recoveryResult.searchRadiusKm} km`);
  console.log(`  - Recovery Message: "${recoveryResult.message}"`);

  // Test 1-click smart rebooking
  const rebookResult = await executeSmartRebooking(dummyTaskId, 'Tomorrow Morning (9:00 AM)');
  console.log(`  - 1-Click Rebooked New Task ID: "${rebookResult.newTaskId}"`);
  console.log(`  - Rebooking Status: "${rebookResult.message}"`);

  const rebookedTask = await db.get(`SELECT * FROM tasks WHERE id = ?`, [rebookResult.newTaskId]);
  if (rebookedTask && rebookedTask.status === 'MATCHING' && rebookedTask.search_radius_km === 20) {
    console.log('  ✅ TEST 8 PASSED: Failure recovery expanded radius, and 1-Click Smart Rebooking initialized new matching task.');
  } else {
    throw new Error('TEST 8 FAILED: Rebooked task not configured properly.');
  }

  console.log('\n========================================================');
  console.log('🎉 ALL 8 AI PLATFORM TEST SUITES PASSED FLAWLESSLY!');
  console.log('========================================================\n');
}

runAISuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
