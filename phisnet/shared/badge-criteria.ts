import { z } from 'zod';

export type BadgeCriterion = { type: 'points_earned' | 'streak_days' | 'quizzes_passed' | 'training_complete' | 'quiz_pass' | 'perfect_score' | 'custom'; target: number; resourceId?: number; description?: string };
export function normalizeBadgeCriterion(input: any): BadgeCriterion {
  if (!input || typeof input !== 'object') throw new Error('Choose a badge requirement');
  const aliases: Record<string,string> = {points:'points_earned',total_points:'points_earned',streak:'streak_days',quiz_completion:'quizzes_passed'};
  const type = aliases[input.type] || input.type;
  if (!['points_earned','streak_days','quizzes_passed','training_complete','quiz_pass','perfect_score','custom'].includes(type)) throw new Error('Unsupported badge requirement');
  if (type === 'custom') {
    if (typeof input.description !== 'string' || !input.description.trim()) throw new Error('Describe the manual requirement');
    return {type,target:1,description:input.description.trim()};
  }
  const resourceId = type === 'quiz_pass' ? input.quizId ?? input.resourceId : type === 'training_complete' ? input.moduleId ?? input.resourceId : undefined;
  if (resourceId !== undefined && (!Number.isSafeInteger(resourceId) || resourceId <= 0)) throw new Error('Select a valid quiz or lesson ID');
  if (type === 'quiz_pass' && !resourceId) throw new Error('Select a quiz');
  const target = input.target ?? input.threshold ?? input.amount ?? input.requiredPoints ?? input.days ?? input.requiredDays ?? input.count ?? input.requiredCount ?? input.requiredCompletions ?? (resourceId ? 1 : undefined);
  if (!Number.isSafeInteger(target) || target <= 0 || target > 10000000) throw new Error('Requirement must be a positive whole number');
  return {type,target,...(resourceId ? {resourceId} : {})};
}
export const badgeCriterionSchema = z.any().transform((value,ctx) => {
  try { return normalizeBadgeCriterion(value); } catch(error) { ctx.addIssue({code:'custom',message:(error as Error).message}); return z.NEVER; }
});
export type BadgeFacts = { points:number; streak:number; quizzes:number[]; training:number[]; perfect:number[] };
export function evaluateBadgeCriterion(input:unknown, facts:BadgeFacts) {
  const criterion=normalizeBadgeCriterion(input);
  const current=criterion.type==='points_earned'?facts.points:criterion.type==='streak_days'?facts.streak:criterion.type==='quizzes_passed'?facts.quizzes.length:criterion.type==='perfect_score'?facts.perfect.length:criterion.type==='quiz_pass'?Number(facts.quizzes.includes(criterion.resourceId!)):criterion.type==='training_complete'?(criterion.resourceId?Number(facts.training.includes(criterion.resourceId)):facts.training.length):0;
  return {current,required:criterion.target,type:criterion.type,progress:Math.min(100,Math.round(current/criterion.target*100)),earned:criterion.type!=='custom'&&current>=criterion.target};
}
export function describeBadgeCriterion(input:unknown) {
  try {
    const c=normalizeBadgeCriterion(input);
    if(c.type==='points_earned')return `Earn ${c.target} total points`;
    if(c.type==='streak_days')return `Be active on ${c.target} consecutive UTC days`;
    if(c.type==='quizzes_passed')return `Pass ${c.target} distinct quizzes`;
    if(c.type==='perfect_score')return `Score 100% in ${c.target} distinct quizzes`;
    if(c.type==='quiz_pass')return `Pass quiz #${c.resourceId}`;
    if(c.type==='training_complete')return c.resourceId?`Complete lesson #${c.resourceId}`:`Complete ${c.target} distinct lessons`;
    return `Manual award: ${c.description}`;
  }catch{return 'Requirement unavailable; contact your administrator';}
}
