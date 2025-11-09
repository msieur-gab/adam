/**
 * NLU Service Comparison Test
 * Compare old regex-based NLU vs compromise-enhanced NLU
 */

import { nluService } from './src/services/nlu-service.js';
import { compromiseNluService } from './src/services/compromise-nlu-service.js';

// Test cases that were failing
const testCases = [
  {
    input: "what's the weather today",
    expectedSubject: 'weather',
    expectedIntent: 'weather_query'
  },
  {
    input: "what's today",
    expectedSubject: 'date',
    expectedIntent: 'date_query'
  },
  {
    input: "tell me the weather for tomorrow",
    expectedSubject: 'weather',
    expectedIntent: 'weather_query'
  },
  {
    input: "what day is today",
    expectedSubject: 'date',
    expectedIntent: 'date_query'
  },
  {
    input: "is it going to rain today",
    expectedSubject: 'weather',
    expectedIntent: 'weather_query'
  },
  {
    input: "what's the date today",
    expectedSubject: 'date',
    expectedIntent: 'date_query'
  },
  {
    input: "how hot is it today",
    expectedSubject: 'weather',
    expectedIntent: 'weather_query'
  },
  {
    input: "when should I take my medication today",
    expectedSubject: 'medication',
    expectedIntent: 'medication_query'
  }
];

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  NLU Service Comparison Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  let oldCorrect = 0;
  let newCorrect = 0;

  for (const testCase of testCases) {
    console.log(`\n📝 Test: "${testCase.input}"`);
    console.log(`   Expected: subject="${testCase.expectedSubject}", intent="${testCase.expectedIntent}"\n`);

    // Test old service
    const oldResult = await nluService.analyze(testCase.input);
    const oldMatch = (
      oldResult.subject === testCase.expectedSubject &&
      oldResult.intent === testCase.expectedIntent
    );

    if (oldMatch) oldCorrect++;

    console.log(`   OLD (regex): subject="${oldResult.subject}", intent="${oldResult.intent}"`);
    console.log(`                ${oldMatch ? '✅ CORRECT' : '❌ WRONG'}`);
    console.log(`                confidence: ${oldResult.confidence.toFixed(2)}`);

    // Test new service
    const newResult = await compromiseNluService.analyze(testCase.input);
    const newMatch = (
      newResult.subject === testCase.expectedSubject &&
      newResult.intent === testCase.expectedIntent
    );

    if (newMatch) newCorrect++;

    console.log(`   NEW (compromise): subject="${newResult.subject}", intent="${newResult.intent}"`);
    console.log(`                     ${newMatch ? '✅ CORRECT' : '❌ WRONG'}`);
    console.log(`                     confidence: ${newResult.confidence.toFixed(2)}`);

    // Show debug info for new service
    if (newResult._debug) {
      console.log(`                     nouns: [${newResult._debug.nouns.join(', ')}]`);
      console.log(`                     scores: ${JSON.stringify(newResult._debug.subjects_scored)}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  OLD (regex):      ${oldCorrect}/${testCases.length} correct (${(oldCorrect/testCases.length*100).toFixed(1)}%)`);
  console.log(`  NEW (compromise): ${newCorrect}/${testCases.length} correct (${(newCorrect/testCases.length*100).toFixed(1)}%)`);
  console.log(`  Improvement:      +${newCorrect - oldCorrect} tests\n`);

  if (newCorrect > oldCorrect) {
    console.log('  ✅ compromise NLU shows improvement!');
  } else if (newCorrect === oldCorrect) {
    console.log('  ⚖️  Both services perform equally');
  } else {
    console.log('  ⚠️  Old service performed better (might need tuning)');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
