import { SplitterOptions } from './options';
import { getInitialDelimiter, scanToken } from './splitQuery';

function createParameterizerContext(sql: string, options: SplitterOptions) {
  return {
    options,
    source: sql,
    position: 0,
    currentDelimiter: getInitialDelimiter(options),
    end: sql.length,
    wasDataOnLine: false,
    isCopyFromStdin: false,
    isCopyFromStdinCandidate: false,
  };
}

export function extractQueryParameters(sql: string, options: SplitterOptions): string[] {
  if (!sql || !options) {
    return [];
  }

  const context = createParameterizerContext(sql, options);

  const res = new Set<string>();

  while (context.position < context.end) {
    const token = scanToken(context);
    if (token === null) {
      break;
    }
    if (token.type === 'parameter') {
      if (token.value == '?') {
        res.add(`?${res.size + 1}`);
      } else {
        res.add(token.value);
      }
    }
    context.position += token.length;
  }

  return Array.from(res);
}

export function replaceQueryParameters(
  sql: string,
  params: { [name: string]: string },
  options: SplitterOptions
): string {
  if (!sql || !options) {
    return sql;
  }

  const context = createParameterizerContext(sql, options);

  let res = '';
  let questionParamCounter = 0;
  while (context.position < context.end) {
    const token = scanToken(context);
    if (token === null) {
      break;
    }
    if (token.type === 'parameter') {
      const paramName = token.value == '?' ? `?${++questionParamCounter}` : token.value;
      if (params[paramName]) {
        res += params[paramName];
      } else {
        res += sql.substring(context.position, context.position + token.length);
      }
    } else {
      res += sql.substring(context.position, context.position + token.length);
    }
    context.position += token.length;
  }

  return res;
}
