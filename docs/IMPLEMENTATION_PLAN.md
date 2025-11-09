# Dialogflow Architecture Implementation Plan

## Overview

This document outlines the phased implementation strategy for migrating ADAM to the Dialogflow-style intent architecture. The migration is designed to be **incremental, testable, and non-breaking**.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Build core infrastructure without breaking existing system

#### Tasks

1. **Create Conversation Context Manager**
   - File: `src/services/conversation-context.js`
   - Features:
     - Context storage with lifespan
     - Turn history tracking (last 10 turns)
     - Auto-decrement lifespan
     - Entity resolution helpers
   - Testing: Unit tests for context lifecycle

2. **Create Enhanced NLU Service**
   - File: `src/services/enhanced-nlu-service.js`
   - Features:
     - Extract all Compromise.js signals
     - Structured signal output
     - Integration with context manager
   - Testing: Compare signal extraction with current NLU

3. **Create Intent Flow Engine**
   - File: `src/services/intent-flow-engine.js`
   - Features:
     - Intent scoring using declarative rules
     - Confidence-based routing
     - Follow-up detection
     - Parameter extraction
   - Testing: Unit tests for scoring algorithm

4. **Update BasePlugin**
   - File: `src/plugins/plugin-base.js`
   - Add method: `getIntentFlows()` (optional, default returns null)
   - Backward compatible with existing `getIntents()` and `handleQuery()`

**Deliverables:**
- 3 new services fully tested
- BasePlugin enhanced but backward compatible
- No changes to existing plugins yet
- Integration tests pass

**Success Criteria:**
- All unit tests pass
- Existing functionality unchanged
- New services ready for integration

---

### Phase 2: Hybrid Mode (Week 2)
**Goal:** Run both systems in parallel for comparison

#### Tasks

1. **Create Dual-Mode NLU Service**
   - File: `src/services/dual-mode-nlu.js`
   - Runs both old and new NLU in parallel
   - Logs comparison of results
   - Falls back to old system for production
   - Feature flag: `USE_INTENT_FLOW_ENGINE`

2. **Add Logging and Telemetry**
   - Track confidence scores (old vs new)
   - Track intent matching accuracy
   - Track performance metrics
   - Create comparison dashboard

3. **Create Migration Helper**
   - File: `src/utils/intent-flow-migrator.js`
   - Converts old intent definitions to new format
   - Validates intent flow schemas
   - Generates boilerplate

**Deliverables:**
- Dual-mode NLU running in dev
- Telemetry showing comparison
- Migration helper tools
- Documentation on differences

**Success Criteria:**
- New system matches or exceeds old confidence scores
- Performance within acceptable limits (<50ms overhead)
- Clear data on improvement areas

---

### Phase 3: Pilot Migration (Week 3)
**Goal:** Migrate one plugin completely to validate approach

#### Tasks

1. **Migrate Weather Plugin**
   - File: `src/plugins/weather-plugin.js`
   - Implement `getIntentFlows()`
   - Add scoring rules
   - Add output contexts
   - Add follow-up handlers
   - Remove old `getIntents()` and `getNLUPatterns()`

2. **Test Weather Plugin Thoroughly**
   - Unit tests for scoring rules
   - Integration tests for follow-ups
   - User acceptance testing
   - Performance benchmarks

3. **Document Migration Process**
   - Create migration guide
   - Document patterns and best practices
   - Create template for other plugins

**Test Scenarios:**
```
✓ "What's the weather?" → Default location, today
✓ "What's the weather tomorrow?" → Default location, tomorrow
✓ "What's the weather in Paris?" → Paris, today
✓ "Weather next week in Tokyo" → Tokyo, next week
✓ "And tomorrow?" (follow-up) → Reuse location
✓ "What about London?" (follow-up) → Reuse timeframe
✓ Low confidence handling
✓ Missing parameter prompting
```

**Deliverables:**
- Weather plugin fully migrated
- All test scenarios passing
- Migration guide documented
- Template created

**Success Criteria:**
- Weather plugin confidence scores improved
- Follow-up conversations working
- Context management verified
- Zero regressions

---

### Phase 4: Full Migration (Week 4-5)
**Goal:** Migrate all remaining plugins

#### Priority Order

1. **High Priority Plugins** (Week 4)
   - Reminder Plugin
   - News Plugin
   - Time Plugin
   - Reason: Most commonly used, high user impact

2. **Medium Priority Plugins** (Week 5)
   - Ambient Sound Plugin
   - Device Control Plugin (if exists)
   - Other utility plugins

3. **Low Priority Plugins** (Week 5)
   - Experimental features
   - Rarely used plugins

#### Migration Checklist (Per Plugin)

```markdown
- [ ] Analyze current intent patterns
- [ ] Define scoring rules
- [ ] Define parameters with extractors
- [ ] Implement fulfillment function
- [ ] Define output contexts
- [ ] Define follow-up handlers
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
- [ ] User acceptance testing
- [ ] Performance validation
```

**Deliverables:**
- All plugins migrated
- Full test coverage
- Updated documentation
- Performance report

**Success Criteria:**
- 100% of plugins on new system
- No regressions in existing features
- Measurable improvement in accuracy
- User feedback positive

---

### Phase 5: Old System Removal (Week 6)
**Goal:** Remove legacy code and clean up

#### Tasks

1. **Remove Old NLU Service**
   - Delete `src/services/nlu-service.js` (old version)
   - Remove dual-mode wrapper
   - Update imports

2. **Clean Up Plugin Base**
   - Remove `getIntents()` and `getNLUPatterns()` (deprecated)
   - Keep only `getIntentFlows()`

3. **Update Tests**
   - Remove old NLU tests
   - Ensure new tests cover all cases

4. **Update Documentation**
   - Archive old docs
   - Update all references to new system

**Deliverables:**
- Clean codebase
- Updated documentation
- Simplified plugin API

**Success Criteria:**
- Zero dead code
- All tests passing
- Documentation accurate
- Bundle size reduced

---

## Detailed File Structure

### New Files to Create

```
src/
├── services/
│   ├── conversation-context.js          [NEW] Phase 1
│   ├── enhanced-nlu-service.js          [NEW] Phase 1
│   ├── intent-flow-engine.js            [NEW] Phase 1
│   ├── dual-mode-nlu.js                 [NEW] Phase 2
│   └── nlu-service.js                   [MODIFY] Phase 5 (rename old)
│
├── plugins/
│   ├── plugin-base.js                   [MODIFY] Phase 1
│   ├── weather-plugin.js                [MIGRATE] Phase 3
│   ├── reminder-plugin.js               [MIGRATE] Phase 4
│   └── ...other plugins...              [MIGRATE] Phase 4
│
├── utils/
│   └── intent-flow-migrator.js          [NEW] Phase 2
│
docs/
├── DIALOGFLOW_ARCHITECTURE.md           [DONE]
├── IMPLEMENTATION_PLAN.md               [DONE]
├── MIGRATION_GUIDE.md                   [NEW] Phase 3
└── INTENT_FLOW_EXAMPLES.md              [NEW] Phase 3
```

---

## Testing Strategy

### Unit Tests

**Conversation Context** (`conversation-context.test.js`)
```javascript
describe('ConversationContext', () => {
  test('should set and get context with lifespan');
  test('should decrement lifespan on each turn');
  test('should delete expired contexts');
  test('should track turn history (max 10)');
  test('should resolve last mentioned entities');
});
```

**Enhanced NLU Service** (`enhanced-nlu-service.test.js`)
```javascript
describe('EnhancedNLUService', () => {
  test('should extract nouns, verbs, adjectives');
  test('should extract dates, times, places, people');
  test('should detect questions and commands');
  test('should detect negation and temporal markers');
  test('should include active contexts in signals');
});
```

**Intent Flow Engine** (`intent-flow-engine.test.js`)
```javascript
describe('IntentFlowEngine', () => {
  test('should score intent using declarative rules');
  test('should apply boosters correctly');
  test('should apply penalties correctly');
  test('should detect follow-up intents');
  test('should route by confidence threshold');
  test('should handle missing parameters');
  test('should set output contexts after fulfillment');
});
```

### Integration Tests

**Weather Plugin Flow** (`weather-plugin-flow.test.js`)
```javascript
describe('Weather Plugin Intent Flow', () => {
  test('basic query with defaults');
  test('query with explicit location');
  test('query with explicit timeframe');
  test('follow-up with temporal modifier');
  test('follow-up with location modifier');
  test('context expires after lifespan');
});
```

**Reminder Plugin Flow** (`reminder-plugin-flow.test.js`)
```javascript
describe('Reminder Plugin Intent Flow', () => {
  test('complete reminder with all params');
  test('multi-turn parameter collection');
  test('missing task parameter prompting');
  test('missing timeframe parameter prompting');
  test('follow-up to cancel reminder');
  test('follow-up to modify reminder');
});
```

### End-to-End Tests

**Conversation Scenarios** (`conversation-e2e.test.js`)
```javascript
describe('Multi-Turn Conversations', () => {
  test('weather with 3-turn follow-up chain');
  test('reminder creation with prompting');
  test('context switching between intents');
  test('disambiguation when ambiguous');
  test('fallback when low confidence');
});
```

---

## Performance Benchmarks

### Metrics to Track

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| Intent resolution latency | ~20ms | <50ms | 2 |
| Memory per conversation | ~2KB | <10KB | 3 |
| Intent confidence (avg) | 0.45 | >0.65 | 4 |
| Follow-up success rate | 0% | >90% | 4 |
| Parameter extraction accuracy | ~70% | >85% | 4 |

### Performance Tests

```javascript
describe('Performance', () => {
  test('intent scoring completes in <10ms', async () => {
    const start = performance.now();
    await intentFlowEngine.scoreAllIntents(signals);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  test('context lookup is O(1)', async () => {
    // Add 100 contexts
    for (let i = 0; i < 100; i++) {
      context.set(`ctx-${i}`, { data: i }, 2);
    }

    const start = performance.now();
    context.get('ctx-50');
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1); // Sub-millisecond
  });
});
```

---

## Risk Mitigation

### Risks and Mitigation Strategies

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| New system performs worse | Medium | High | Dual-mode testing in Phase 2 |
| Migration introduces bugs | Medium | High | Incremental migration, extensive testing |
| Performance degradation | Low | Medium | Benchmark each phase, optimize early |
| User confusion from changes | Low | Low | No UX changes, internal only |
| Context memory leaks | Low | Medium | Strict lifespan management, monitoring |

### Rollback Plan

**Phase 1-2:** Easy rollback (feature flag)
- Set `USE_INTENT_FLOW_ENGINE = false`
- Old system still active

**Phase 3-4:** Git branch rollback
- Keep old system in separate branch
- Can merge back if critical issues

**Phase 5:** Full commit, no rollback
- Only proceed if Phase 4 is 100% validated
- Extensive user testing before Phase 5

---

## Success Metrics

### Quantitative Metrics

1. **Intent Confidence Improvement**
   - Before: Average 45% confidence
   - After: Average >65% confidence
   - Measurement: Log all intent scores

2. **Follow-Up Success Rate**
   - Before: 0% (not supported)
   - After: >90% accuracy on follow-ups
   - Measurement: Dedicated test suite

3. **Parameter Extraction Accuracy**
   - Before: ~70% (manual inspection)
   - After: >85%
   - Measurement: Unit tests with known inputs

4. **Performance**
   - Latency: <50ms for intent resolution
   - Memory: <10KB per conversation
   - Measurement: Performance benchmarks

### Qualitative Metrics

1. **Developer Experience**
   - Plugin migration time: <2 hours per plugin
   - Code clarity: Developers prefer declarative style
   - Measurement: Survey after Phase 4

2. **User Satisfaction**
   - Follow-up conversations feel natural
   - Fewer "I don't understand" responses
   - Measurement: User testing feedback

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | Week 1 | Core services ready |
| Phase 2: Hybrid Mode | Week 2 | Comparison data |
| Phase 3: Pilot Migration | Week 3 | Weather plugin migrated |
| Phase 4: Full Migration | Week 4-5 | All plugins migrated |
| Phase 5: Cleanup | Week 6 | Old code removed |

**Total Estimated Time:** 6 weeks

**Next Steps:** Begin Phase 1 with Conversation Context Manager implementation.

---

## Getting Started

### Immediate Next Steps

1. Review this plan with team
2. Get approval to proceed
3. Create feature branch: `dialogflow-intent-architecture`
4. Begin Phase 1, Task 1: Conversation Context Manager
5. Set up telemetry for comparison (Phase 2 prep)

### Questions to Resolve Before Starting

- [ ] Confirm timeline is acceptable
- [ ] Confirm resource allocation
- [ ] Confirm testing requirements
- [ ] Confirm performance targets
- [ ] Confirm rollback strategy

---

**Ready to begin implementation?** See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions (to be created in Phase 3).
