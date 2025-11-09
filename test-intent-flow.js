/**
 * Intent Flow Engine Test
 * Demonstrates the new Dialogflow-style architecture in action
 */

import { IntentFlowEngine } from './src/services/intent-flow-engine.js';
import { TimePlugin } from './src/plugins/time-plugin.js';

console.log('🎯 Intent Flow Engine Test\n');
console.log('='.repeat(60));

// Create engine and plugin instances
const engine = new IntentFlowEngine();
const timePlugin = new TimePlugin();

// Initialize plugin
await timePlugin.initialize();

// Register plugin with engine
console.log('\n📝 Registering TimePlugin with IntentFlowEngine...');
engine.registerPlugin(timePlugin);

console.log('✅ Plugin registered successfully');
console.log(`   Registered intents: ${engine.getRegisteredIntents().join(', ')}`);

// Test cases
const testCases = [
  {
    input: "What time is it?",
    expected: "Should match time_query with HIGH confidence (question + noun 'time')"
  },
  {
    input: "Tell me the time",
    expected: "Should match time_query with HIGH confidence (verb 'tell' + noun 'time')"
  },
  {
    input: "What's the time now?",
    expected: "Should match time_query with HIGH confidence"
  },
  {
    input: "Show me the clock",
    expected: "Should match time_query with MEDIUM-HIGH confidence (verb 'show' + noun 'clock')"
  },
  {
    input: "What's the weather?",
    expected: "Should NOT match time_query (anti-pattern: 'weather')"
  },
  {
    input: "Set a reminder for 3pm",
    expected: "Should NOT match time_query (anti-pattern: 'reminder', has 'time' but in different context)"
  }
];

console.log('\n' + '='.repeat(60));
console.log('🧪 Running Test Cases\n');

for (const [index, testCase] of testCases.entries()) {
  console.log(`\nTest ${index + 1}/${testCases.length}: "${testCase.input}"`);
  console.log('Expected:', testCase.expected);
  console.log('-'.repeat(60));

  try {
    const result = await engine.execute(testCase.input);

    console.log('Result:');
    console.log('  Text:', result.text || 'N/A');
    console.log('  Type:', result.type || 'fulfillment');
    console.log('  Hedged:', result.hedged || false);
    console.log('  Fallback:', result.fallback || false);

    if (result.data) {
      console.log('  Data:', JSON.stringify(result.data, null, 2));
    }

    // Visual indicator
    if (result.text && result.text.includes("It's")) {
      console.log('✅ MATCHED time_query');
    } else if (result.fallback) {
      console.log('❌ FALLBACK (no match)');
    } else {
      console.log('⚠️  OTHER');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n✨ Test Complete!\n');

// Show debug info
console.log('🔍 Engine Debug Info:');
const debugInfo = engine.getDebugInfo();
console.log(JSON.stringify(debugInfo, null, 2));

console.log('\n📊 Summary:');
console.log(`  Registered Intents: ${debugInfo.registeredIntents.length}`);
console.log(`  Confidence Thresholds: HIGH=${debugInfo.thresholds.HIGH}, MEDIUM=${debugInfo.thresholds.MEDIUM}`);
console.log(`  Active Contexts: ${debugInfo.contextInfo.contextCount}`);
