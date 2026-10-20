import { ScoringEngine } from '@maestro/shared';
import { RuleBasedScoringEngine } from './RuleBasedScoringEngine';
import { env } from '../../config/env';

/**
 * PerformanceService always asks THIS factory for a ScoringEngine rather
 * than importing RuleBasedScoringEngine directly. When an ML service
 * becomes available, add an `MLScoringEngine` implementation (HTTP call
 * to env.mlServiceUrl) and flip the branch below — no other file in the
 * codebase needs to change.
 */
export function getScoringEngine(): ScoringEngine {
  if (env.mlServiceUrl) {
    // Future: return new MLScoringEngine(env.mlServiceUrl);
    console.warn('[scoring] ML_SERVICE_URL is set but no MLScoringEngine is implemented yet — falling back to rule-based.');
  }
  return new RuleBasedScoringEngine();
}
