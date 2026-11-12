/** Reject isolated fragments, while retaining complete concepts such as
 * train-the-trainer programs and customer education. Mirrored in the AI service. */
export function actionableSkillLabel(value: string): boolean {
  const label = value.trim().toLowerCase().replace(/[.!?:]+$/, '');
  return Boolean(label) && !/^(?:language polyglot|polyglot|growth opportunities|analytics tools?|content|train|trainer|trainee|center|centre|excellence|team|teams|brand|product|business|company|candidate|ability|proficiency|experience|skills?|strong|excellent)$/.test(label);
}
