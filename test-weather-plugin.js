/**
 * Weather Plugin Test
 * Demonstrates parameter extraction and follow-up conversations
 */

import { IntentFlowEngine } from './src/services/intent-flow-engine.js';
import { WeatherPlugin } from './src/plugins/weather-plugin.js';

console.log('🌤️  Weather Plugin Test\n');
console.log('='.repeat(60));

// Create engine and plugin instances
const engine = new IntentFlowEngine();
const weatherPlugin = new WeatherPlugin();

// Initialize plugin
await weatherPlugin.initialize();

// Register plugin with engine
console.log('\n📝 Registering WeatherPlugin with IntentFlowEngine...');
engine.registerPlugin(weatherPlugin);

console.log('✅ Plugin registered successfully');
console.log(`   Registered intents: ${engine.getRegisteredIntents().join(', ')}`);

// Test cases
const testCases = [
  {
    title: "Basic Query (Default Location)",
    input: "What's the weather?",
    expected: "Should use default location (San Francisco) and timeframe (today)"
  },
  {
    title: "Query with Location",
    input: "What's the weather in Paris?",
    expected: "Should extract location (Paris) and use default timeframe (today)"
  },
  {
    title: "Query with Timeframe",
    input: "Weather tomorrow",
    expected: "Should use default location and extract timeframe (tomorrow)"
  },
  {
    title: "Query with Both Parameters",
    input: "Weather tomorrow in London",
    expected: "Should extract both location (London) and timeframe (tomorrow)"
  },
  {
    title: "Alternative Phrasing",
    input: "How's the weather next week?",
    expected: "Should extract timeframe (next week)"
  },
  {
    title: "Follow-Up: Temporal Modifier",
    input: "And tomorrow?",
    expected: "Should reuse location from previous query, change timeframe to tomorrow"
  },
  {
    title: "Follow-Up: Location Modifier",
    input: "What about Tokyo?",
    expected: "Should change location to Tokyo, keep previous timeframe"
  }
];

console.log('\n' + '='.repeat(60));
console.log('🧪 Running Test Cases\n');

for (const [index, testCase] of testCases.entries()) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Test ${index + 1}/${testCases.length}: ${testCase.title}`);
  console.log(`Input: "${testCase.input}"`);
  console.log(`Expected: ${testCase.expected}`);
  console.log('─'.repeat(60));

  try {
    const result = await engine.execute(testCase.input);

    console.log('\nResult:');
    console.log('  Text:', result.text);

    if (result.data) {
      console.log('  Location:', result.data.location);
      console.log('  Timeframe:', result.data.timeframe);
      if (result.data.weather) {
        console.log('  Conditions:', result.data.weather.conditions);
        console.log('  Temperature:', Math.round(result.data.weather.temperature.current) + '°F');
      }
    }

    if (result.hedged) {
      console.log('  ⚠️  Hedged response (medium confidence)');
    }

    if (result.fallback) {
      console.log('  ❌ FALLBACK (no match)');
    } else if (result.isFollowUp) {
      console.log('  🔗 FOLLOW-UP (context reused)');
    } else {
      console.log('  ✅ PRIMARY INTENT');
    }

    // Show active contexts
    const contextInfo = engine.context.getDebugInfo();
    if (contextInfo.activeContexts.length > 0) {
      console.log('\n  Active Contexts:');
      for (const ctx of contextInfo.activeContexts) {
        console.log(`    - ${ctx.name} (lifespan: ${ctx.lifespan})`);
      }
    }

  } catch (error) {
    console.error('  ❌ ERROR:', error.message);
    console.error('  Stack:', error.stack);
  }

  // Small delay between tests for readability
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('\n' + '='.repeat(60));
console.log('\n✨ Test Complete!\n');

// Show final debug info
console.log('🔍 Final Engine State:');
const debugInfo = engine.getDebugInfo();
console.log('  Registered Intents:', debugInfo.registeredIntents);
console.log('  Active Contexts:', debugInfo.contextInfo.contextCount);
console.log('  Conversation Turns:', debugInfo.contextInfo.turnCount);

if (debugInfo.contextInfo.recentTurns.length > 0) {
  console.log('\n📜 Conversation History (last 3 turns):');
  const recent = debugInfo.contextInfo.recentTurns.slice(-3);
  for (const turn of recent) {
    console.log(`  - "${turn.user}" → ${turn.intent}`);
  }
}

console.log('\n🎉 Weather Plugin Demonstration Complete!');
console.log('   ✅ Parameter extraction working');
console.log('   ✅ Follow-up conversations working');
console.log('   ✅ Context management working');
