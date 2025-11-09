/**
 * Integration test - Test the full conversation service with compromise NLU
 */

import { enhancedConversationService } from './src/services/enhanced-conversation-service.js';

const testQueries = [
  "what's the weather today",
  "what's today",
  "how hot is it today"
];

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Integration Test - Enhanced Conversation Service');
console.log('  (Using Compromise NLU)');
console.log('═══════════════════════════════════════════════════════════\n');

for (const query of testQueries) {
  console.log(`\n🗣️  User: "${query}"`);

  const result = await enhancedConversationService.generateResponse(query, {
    name: 'Test User'
  });

  console.log(`\n📊 NLU Analysis:`);
  console.log(`   - Subject: ${result.nlu.subject}`);
  console.log(`   - Intent: ${result.nlu.intent}`);
  console.log(`   - Confidence: ${result.nlu.confidence.toFixed(2)}`);
  console.log(`   - Nouns detected: [${result.nlu._debug.nouns.join(', ')}]`);

  console.log(`\n🤖 Response: "${result.text}"`);
  console.log(`\n${'─'.repeat(60)}`);
}

console.log('\n✅ Integration test complete!\n');
