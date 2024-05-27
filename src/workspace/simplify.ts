import * as ts from 'typescript';

interface ConditionResult {
  condition: string;
  result: string;
}

function extractTernaryConditions(node: ts.Node, sourceFile: ts.SourceFile, conditions: ConditionResult[]): void {
  if (ts.isConditionalExpression(node)) {
    const condition = node.condition.getText(sourceFile).trim();
    const whenTrue = node.whenTrue.getText(sourceFile).trim();
    const whenFalse = node.whenFalse;

    conditions.push({ condition, result: whenTrue });

    if (ts.isConditionalExpression(whenFalse)) {
      extractTernaryConditions(whenFalse, sourceFile, conditions);
    } else {
      conditions.push({ condition: 'else', result: whenFalse.getText(sourceFile).trim() });
    }
  }
}

function groupByResult(conditions: ConditionResult[]): Record<string, Set<string>> {
  const resultCountMap: Record<string, Set<string>> = {};
  conditions.forEach(({ condition, result }) => {
    if (!resultCountMap[result]) {
      resultCountMap[result] = new Set();
    }
    if (condition !== 'else') {
      resultCountMap[result].add(condition);
    }
  });
  return resultCountMap;
}

function simplify(inputCode: string): string {
  const sourceFile = ts.createSourceFile('temp.ts', inputCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const conditions: ConditionResult[] = [];

  ts.forEachChild(sourceFile, node => extractTernaryConditions(node, sourceFile, conditions));

  if (conditions.length === 0) {
    return inputCode;
  }

  const resultCountMap = groupByResult(conditions);
  const primaryResult = Object.keys(resultCountMap).reduce((a, b) =>
    resultCountMap[a].size >= resultCountMap[b].size ? a : b
  );

  const primaryConditions = Array.from(resultCountMap[primaryResult]);
  const primaryCondition = primaryConditions.length > 0 ? primaryConditions.map(c => `(${c})`).join(' || ') : 'true';

  const defaultConditionResult = conditions.find(({ condition }) => condition === 'else')?.result || primaryResult;
  const secondaryResults = Object.keys(resultCountMap).filter(result => result !== primaryResult);
  const secondaryResult = secondaryResults.length > 0 ? secondaryResults[0] : defaultConditionResult;

  return `${primaryCondition} ? ${primaryResult} : ${secondaryResult}`;
}

export { simplify };