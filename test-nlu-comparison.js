/**
 * Test script to compare old vs new NLU services
 * Run: node test-nlu-comparison.js
 */

import { nluService } from './src/services/nlu-service.js';
import { nluServiceV2 } from './src/services/nlu-service-v2.js';

const testQueries = [
  // Weather queries
  "What's the weather tomorrow?",
  "Will it rain next Tuesday in Paris?",
  "What's the temperature?",
  "Is it going to be sunny?",

  // Date/time queries
  "What's the date today?",
  "What will the date be in 3 days?",
  "What time is it?",

  // Temporal expressions (challenging)
  "Remind me the day after tomorrow",
  "What's happening next Friday afternoon?",

  // Complex queries
  "Call my daughter Sarah tomorrow at 3pm",
  "Weather forecast for London next week"
];

async function compareServices() {
  console.log('🧪 NLU Service Comparison Test\n');
  console.log('Initializing v2 models...');

  try {
    await nluServiceV2.initialize();
    console.log('✅ V2 models loaded\n');
  } catch (error) {
    console.error('❌ V2 initialization failed:', error.message);
    console.log('Note: Run "npm install chrono-node compromise" to use v2\n');
  }

  let v1Correct = 0;
  let v2Correct = 0;
  let total = 0;

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log('='.repeat(60));

    total++;

    // Test V1 (old service)
    try {
      const startV1 = performance.now();
      const v1 = await nluService.analyze(query);
      const timeV1 = Math.round(performance.now() - startV1);

      console.log('\n📊 V1 (Regex-based):');
      console.log(`  Intent: ${v1.intent} (confidence: ${v1.confidence.toFixed(2)})`);
      console.log(`  Question Type: ${v1.questionType}`);
      console.log(`  Temporal: ${v1.entities.temporal?.value || 'none'}`);
      console.log(`  Location: ${v1.entities.location?.value || 'none'}`);
      console.log(`  Time: ${timeV1}ms`);

      if (v1.confidence > 0.5) v1Correct++;
    } catch (error) {
      console.log('\n📊 V1: Error -', error.message);
    }

    // Test V2 (library-based)
    try {
      const startV2 = performance.now();
      const v2 = await nluServiceV2.analyze(query);
      const timeV2 = Math.round(performance.now() - startV2);

      console.log('\n🚀 V2 (Library-based):');
      console.log(`  Intent: ${v2.intent} (confidence: ${v2.confidence.toFixed(2)})`);
      console.log(`  Question Type: ${v2.questionType}`);
      console.log(`  Temporal: ${v2.entities.temporal?.text || 'none'}`);
      console.log(`  Locations: ${v2.entities.locations?.join(', ') || 'none'}`);
      console.log(`  People: ${v2.entities.persons?.join(', ') || 'none'}`);
      console.log(`  Time: ${timeV2}ms`);

      if (v2.confidence > 0.5) v2Correct++;

      // Show improvement
      const v1Intent = v1.intent;
      const v2Intent = v2.intent;
      if (v1Intent !== v2Intent) {
        console.log(`\n⚠️  Intent changed: ${v1Intent} → ${v2Intent}`);
      }
    } catch (error) {
      console.log('\n🚀 V2: Error -', error.message);
      console.log('   (Install libraries: npm install chrono-node compromise)');
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total queries: ${total}`);
  console.log(`V1 success rate: ${v1Correct}/${total} (${Math.round(v1Correct/total*100)}%)`);
  console.log(`V2 success rate: ${v2Correct}/${total} (${Math.round(v2Correct/total*100)}%)`);
  console.log(`\nImprovement: ${v2Correct > v1Correct ? '✅' : '⚠️'} ${v2Correct - v1Correct > 0 ? '+' : ''}${v2Correct - v1Correct} queries`);

  console.log('\n💡 Recommendation:');
  if (v2Correct > v1Correct) {
    console.log('   Use V2 (library-based) for better accuracy');
    console.log('   Set USE_V2_NLU = true in enhanced-conversation-service.js');
  } else {
    console.log('   Stick with V1 for now, or investigate V2 issues');
  }
  console.log('');
}

// Run comparison
compareServices().catch(console.error);
