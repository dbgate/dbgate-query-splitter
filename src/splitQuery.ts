import { SplitterOptions, defaultSplitterOptions } from './options';

const SEMICOLON = ';';
const BEGIN_EXTRA_KEYWORDS = ['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE', 'TRANSACTION'];
const BEGIN_EXTRA_KEYWORDS_REGEX = new RegExp(`^(?:${BEGIN_EXTRA_KEYWORDS.join('|')})`, 'i');
const END_EXTRA_KEYWORDS = ['TRANSACTION', 'IF'];
const END_EXTRA_KEYWORDS_REGEX = new RegExp(`^(?:${END_EXTRA_KEYWORDS.join('|')})`, 'i');

type SplitterSpecialMarkerType = 'copy_stdin_start' | 'copy_stdin_end' | 'copy_stdin_line';
export interface SplitStreamContext {
  options: SplitterOptions;
  currentDelimiter: string;
  pushOutput: (item: SplitResultItem) => void;
  commandPart: string;

  line: number;
  column: number;
  streamPosition: number;

  noWhiteLine: number;
  noWhiteColumn: number;
  noWhitePosition: number;

  commandStartPosition: number;
  commandStartLine: number;
  commandStartColumn: number;

  trimCommandStartPosition: number;
  trimCommandStartLine: number;
  trimCommandStartColumn: number;

  wasDataInCommand: boolean;

  isCopyFromStdin: boolean;
  isCopyFromStdinCandidate: boolean;
}

export interface ScannerContext {
  readonly options: SplitterOptions;
  readonly source: string;
  readonly position: number;
  readonly currentDelimiter: string;
  readonly end: number;
  readonly wasDataOnLine: boolean;
  readonly isCopyFromStdin: boolean;
  readonly isCopyFromStdinCandidate: boolean;
  readonly beginEndIdentLevel: number;
}

export interface SplitLineContext extends SplitStreamContext {
  source: string;
  position: number;
  // output: string[];
  end: number;
  wasDataOnLine: boolean;
  currentCommandStart: number;
  beginEndIdentLevel: number;

  //   unread: string;
  //   currentStatement: string;
  //   semicolonKeyTokenRegex: RegExp;
}

export interface SplitPositionDefinition {
  position: number;
  line: number;
  column: number;
}

export interface SplitResultItemRich {
  text: string;
  start: SplitPositionDefinition;
  end: SplitPositionDefinition;
  trimStart?: SplitPositionDefinition;
  trimEnd?: SplitPositionDefinition;
  specialMarker?: SplitterSpecialMarkerType;
}

export type SplitResultItem = string | SplitResultItemRich;

function movePosition(context: SplitLineContext, count: number, isWhite: boolean) {
  let { source, position, line, column, streamPosition } = context;
  while (count > 0) {
    if (source[position] == '\n') {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
    position += 1;
    streamPosition += 1;
    count -= 1;
  }
  context.position = position;
  context.streamPosition = streamPosition;
  context.line = line;
  context.column = column;

  if (!context.wasDataInCommand) {
    if (isWhite) {
      context.trimCommandStartPosition = streamPosition;
      context.trimCommandStartLine = line;
      context.trimCommandStartColumn = column;
    } else {
      context.wasDataInCommand = true;
    }
  }

  if (!isWhite) {
    context.noWhitePosition = streamPosition;
    context.noWhiteLine = line;
    context.noWhiteColumn = column;
  }
}

interface Token {
  type:
    | 'string'
    | 'delimiter'
    | 'end'
    | 'begin'
    | 'whitespace'
    | 'eoln'
    | 'data'
    | 'slash_delimiter'
    | 'set_delimiter'
    | 'set_sqlterminator'
    | 'comment'
    | 'go_delimiter'
    | 'create_routine'
    | 'copy'
    | 'copy_stdin_start'
    | 'copy_stdin_end'
    | 'copy_stdin_line'
    | 'parameter';
  length: number;
  lengthWithoutWhitespace?: number;
  value?: string;
}

const WHITESPACE_TOKEN: Token = {
  type: 'whitespace',
  length: 1,
};
const EOLN_TOKEN: Token = {
  type: 'eoln',
  length: 1,
};
const DATA_TOKEN: Token = {
  type: 'data',
  length: 1,
};

function scanDollarQuotedString(context: ScannerContext): Token {
  if (!context.options.allowDollarDollarString) return null;

  let pos = context.position;
  const s = context.source;

  const match = /^(\$[a-zA-Z0-9_]*\$)/.exec(s.slice(pos));
  if (!match) return null;
  const label = match[1];
  pos += label.length;

  while (pos < context.end) {
    if (s.slice(pos).startsWith(label)) {
      return {
        type: 'string',
        length: pos + label.length - context.position,
      };
    }
    pos++;
  }

  return null;
}

export function scanToken(context: ScannerContext): Token {
  let pos = context.position;
  const s = context.source;
  const ch = s[pos];

  if (context.isCopyFromStdin) {
    if (s.slice(pos).startsWith('\\.') && !context.wasDataOnLine) {
      return {
        type: 'copy_stdin_end',
        length: 2,
      };
    }

    let pos2 = pos;
    while (pos2 < context.end && s[pos2] != '\n') pos2++;
    if (pos2 < context.end && s[pos2] == '\n') pos2++;
    return {
      type: 'copy_stdin_line',
      length: pos2 - pos,
    };
  }

  if (context.options.stringsBegins.includes(ch)) {
    pos++;
    const endch = context.options.stringsEnds[ch];
    const escapech = context.options.stringEscapes[ch];
    while (pos < context.end) {
      if (s[pos] == endch) {
        break;
      }

      if (escapech && s[pos] == escapech) {
        pos += 2;
      } else {
        pos++;
      }
    }
    return {
      type: 'string',
      length: pos - context.position + 1,
    };
  }

  if (
    context.options.queryParameterStyle &&
    context.options.queryParameterStyle?.length == 1 &&
    ch == context.options.queryParameterStyle &&
    (context.options.queryParameterStyle == '?' || /[a-zA-Z0-9_]/.test(s[pos + 1]))
  ) {
    pos++;
    if (context.options.queryParameterStyle != '?') {
      while (pos < context.end && /[a-zA-Z0-9_]/.test(s[pos])) pos++;
    }

    return {
      type: 'parameter',
      value: s.slice(context.position, pos),
      length: pos - context.position,
    };
  }

  const isInBeginEnd = context.options.skipSeparatorBeginEnd && context.beginEndIdentLevel > 0;
  if (context.currentDelimiter && s.slice(pos).startsWith(context.currentDelimiter) && !isInBeginEnd) {
    return {
      type: 'delimiter',
      length: context.currentDelimiter.length,
    };
  }

  if (ch == ' ' || ch == '\t' || ch == '\r') {
    return WHITESPACE_TOKEN;
  }

  if (ch == '\n') {
    return EOLN_TOKEN;
  }

  if (context.options.doubleDashComments && ch == '-' && s[pos + 1] == '-') {
    while (pos < context.end && s[pos] != '\n') pos++;
    return {
      type: 'comment',
      length: pos - context.position,
    };
  }

  if (context.options.multilineComments && ch == '/' && s[pos + 1] == '*') {
    pos += 2;
    while (pos < context.end) {
      if (s[pos] == '*' && s[pos + 1] == '/') break;
      pos++;
    }
    return {
      type: 'comment',
      length: pos - context.position + 2,
    };
  }

  if (context.options.allowCustomDelimiter && !context.wasDataOnLine) {
    const m = s.slice(pos).match(/^DELIMITER[ \t]+([^\n]+)/i);
    if (m) {
      return {
        type: 'set_delimiter',
        value: m[1].trim(),
        length: m[0].length,
      };
    }
  }

  if (context.options.allowCustomSqlTerminator) {
    const m = s.slice(pos).match(/^SET[ \t]+SQLT(ERMINATOR)?[ \t]+(ON|OFF|".")/i);
    if (m) {
      if (m[2].toUpperCase() == 'OFF') {
        return {
          type: 'set_sqlterminator',
          value: null,
          length: m[0].length,
        };
      }
      if (m[2].toUpperCase() == 'ON') {
        return {
          type: 'set_sqlterminator',
          value: SEMICOLON,
          length: m[0].length,
        };
      }
      if (m[2].startsWith('"')) {
        return {
          type: 'set_sqlterminator',
          value: m[2].slice(1, -1),
          length: m[0].length,
        };
      }
    }
  }

  if ((context.options.allowGoDelimiter || context.options.adaptiveGoSplit) && !context.wasDataOnLine) {
    const m = s.slice(pos).match(/^GO[\t\r ]*(\n|$)/i);
    if (m) {
      return {
        type: 'go_delimiter',
        length: m[0].endsWith('\n') ? m[0].length - 1 : m[0].length,
      };
    }
  }

  if (context.options.allowSlashDelimiter && !context.wasDataOnLine) {
    const m = s.slice(pos).match(/^\/[\t\r ]*(\n|$)/i);
    if (m) {
      return {
        type: 'slash_delimiter',
        length: m[0].endsWith('\n') ? m[0].length - 1 : m[0].length,
      };
    }
  }

  if (context.options.adaptiveGoSplit) {
    const m = s.slice(pos).match(/^(CREATE|ALTER)\s*(PROCEDURE|FUNCTION|TRIGGER)/i);
    if (m) {
      return {
        type: 'create_routine',
        length: m[0].length,
      };
    }
  }

  if (context.options.copyFromStdin && !context.wasDataOnLine && s.slice(pos).startsWith('COPY ')) {
    return {
      type: 'copy',
      length: 5,
    };
  }

  if (context.isCopyFromStdinCandidate && s.slice(pos).startsWith('FROM stdin;')) {
    let pos2 = pos + 'FROM stdin;'.length;
    const pos0 = pos2 - 1;
    while (pos2 < context.end && s[pos2] != '\n') pos2++;
    if (s[pos2] == '\n') pos2++;
    return {
      type: 'copy_stdin_start',
      length: pos2 - pos,
      lengthWithoutWhitespace: pos0 - pos,
    };
  }

  if (context.options.skipSeparatorBeginEnd && s.slice(pos).match(/^begin/i)) {
    let pos2 = pos + 'BEGIN'.length;
    let pos0 = pos2;

    while (pos0 < context.end && /[^a-zA-Z0-9]/.test(s[pos0])) pos0++;

    if (!BEGIN_EXTRA_KEYWORDS_REGEX.test(s.slice(pos0))) {
      return {
        type: 'begin',
        length: pos2 - pos,
        lengthWithoutWhitespace: pos0 - pos,
      };
    }
  }

  if (context.options.skipSeparatorBeginEnd && s.slice(pos).match(/^end/i)) {
    let pos2 = pos + 'END'.length;
    let pos0 = pos2;

    while (pos0 < context.end && /[^a-zA-Z0-9]/.test(s[pos0])) pos0++;

    if (!END_EXTRA_KEYWORDS_REGEX.test(s.slice(pos0))) {
      return {
        type: 'end',
        length: pos2 - pos,
      };
    }
  }

  const dollarString = scanDollarQuotedString(context);
  if (dollarString) return dollarString;

  return DATA_TOKEN;
}

function containsDataAfterDelimiterOnLine(context: ScannerContext, delimiter: Token): boolean {
  const cloned = {
    options: context.options,
    source: context.source,
    position: context.position,
    currentDelimiter: context.currentDelimiter,
    end: context.end,
    wasDataOnLine: context.wasDataOnLine,
    isCopyFromStdinCandidate: context.isCopyFromStdinCandidate,
    isCopyFromStdin: context.isCopyFromStdin,
    beginEndIdentLevel: context.beginEndIdentLevel,
  };

  cloned.position += delimiter.length;

  while (cloned.position < cloned.end) {
    const token = scanToken(cloned);

    if (!token) {
      cloned.position += 1;
      continue;
    }

    switch (token.type) {
      case 'whitespace':
        cloned.position += token.length;
        continue;
      case 'eoln':
        return false;
      case 'comment':
        if (token.value?.includes('\n')) return true;
        cloned.position += token.length;
        continue;
      default:
        return true;
    }
  }
}

function pushQuery(context: SplitLineContext, specialMarker?: SplitterSpecialMarkerType) {
  context.commandPart += context.source.slice(context.currentCommandStart, context.position);
  pushCurrentQueryPart(context, specialMarker);
}

function pushCurrentQueryPart(context: SplitStreamContext, specialMarker?: SplitterSpecialMarkerType) {
  const trimmed = context.commandPart.substring(
    context.trimCommandStartPosition - context.commandStartPosition,
    context.noWhitePosition - context.commandStartPosition
  );

  if (trimmed.trim()) {
    if (context.options.returnRichInfo) {
      context.pushOutput({
        text: trimmed,

        start: {
          position: context.commandStartPosition,
          line: context.commandStartLine,
          column: context.commandStartColumn,
        },

        end: {
          position: context.streamPosition,
          line: context.line,
          column: context.column,
        },

        trimStart: {
          position: context.trimCommandStartPosition,
          line: context.trimCommandStartLine,
          column: context.trimCommandStartColumn,
        },

        trimEnd: {
          position: context.noWhitePosition,
          line: context.noWhiteLine,
          column: context.noWhiteColumn,
        },

        specialMarker,
      });
    } else {
      context.pushOutput(trimmed);
    }
  }
}

function markStartCommand(context: SplitLineContext) {
  context.commandStartPosition = context.streamPosition;
  context.commandStartLine = context.line;
  context.commandStartColumn = context.column;

  context.trimCommandStartPosition = context.streamPosition;
  context.trimCommandStartLine = context.line;
  context.trimCommandStartColumn = context.column;

  context.wasDataInCommand = false;
}

function splitByLines(context: SplitLineContext) {
  while (context.position < context.end) {
    if (context.source[context.position] == '\n') {
      pushQuery(context);
      context.commandPart = '';
      movePosition(context, 1, true);
      context.currentCommandStart = context.position;
      markStartCommand(context);
    } else {
      movePosition(context, 1, /\s/.test(context.source[context.position]));
    }
  }

  if (context.end > context.currentCommandStart) {
    context.commandPart += context.source.slice(context.currentCommandStart, context.position);
  }
}

export function splitQueryLine(context: SplitLineContext) {
  if (context.options.splitByLines) {
    splitByLines(context);
    return;
  }

  while (context.position < context.end) {
    const token = scanToken(context);
    if (!token) {
      // nothing special, move forward
      movePosition(context, 1, false);
      continue;
    }
    switch (token.type) {
      case 'string':
        movePosition(context, token.length, false);
        context.wasDataOnLine = true;
        break;
      case 'comment':
        movePosition(context, token.length, !!context.options.ignoreComments);
        context.wasDataOnLine = true;
        break;
      case 'eoln':
        movePosition(context, token.length, true);
        context.wasDataOnLine = false;
        break;
      case 'data':
        movePosition(context, token.length, false);
        context.wasDataOnLine = true;
        break;
      case 'parameter':
        movePosition(context, token.length, false);
        context.wasDataOnLine = true;
        break;
      case 'whitespace':
        movePosition(context, token.length, true);
        break;
      case 'set_delimiter':
      case 'set_sqlterminator':
        pushQuery(context);
        context.commandPart = '';
        context.currentDelimiter = token.value;
        movePosition(context, token.length, false);
        context.currentCommandStart = context.position;
        markStartCommand(context);
        break;
      case 'go_delimiter':
        pushQuery(context);
        context.commandPart = '';
        movePosition(context, token.length, false);
        context.currentCommandStart = context.position;
        markStartCommand(context);
        if (context.options.adaptiveGoSplit) {
          context.currentDelimiter = SEMICOLON;
        }
        break;
      case 'slash_delimiter':
        pushQuery(context);
        context.commandPart = '';
        movePosition(context, token.length, false);
        context.currentCommandStart = context.position;
        markStartCommand(context);
        break;
      case 'create_routine':
        movePosition(context, token.length, false);
        if (context.options.adaptiveGoSplit) {
          context.currentDelimiter = null;
        }
        break;
      case 'copy':
        movePosition(context, token.length, false);
        context.isCopyFromStdinCandidate = true;
        context.wasDataOnLine = true;
        break;
      case 'copy_stdin_start':
        movePosition(context, token.lengthWithoutWhitespace, false);
        movePosition(context, token.length - token.lengthWithoutWhitespace!, true);
        context.isCopyFromStdin = true;
        context.isCopyFromStdinCandidate = false;
        context.wasDataOnLine = false;

        pushQuery(context, 'copy_stdin_start');
        context.commandPart = '';
        context.currentCommandStart = context.position;
        markStartCommand(context);

        break;
      case 'copy_stdin_line':
        movePosition(context, token.length, false);
        context.isCopyFromStdin = true;
        context.isCopyFromStdinCandidate = false;

        pushQuery(context, 'copy_stdin_line');
        context.commandPart = '';
        context.currentCommandStart = context.position;
        markStartCommand(context);

        break;
      case 'copy_stdin_end':
        movePosition(context, token.length, false);
        context.isCopyFromStdin = false;
        context.wasDataOnLine = true;

        pushQuery(context, 'copy_stdin_end');
        context.commandPart = '';
        context.currentCommandStart = context.position;
        markStartCommand(context);

        break;
      case 'delimiter':
        if (context.options.preventSingleLineSplit && containsDataAfterDelimiterOnLine(context, token)) {
          movePosition(context, token.length, false);
          context.wasDataOnLine = true;
          break;
        }
        pushQuery(context);
        context.commandPart = '';
        movePosition(context, token.length, false);
        context.currentCommandStart = context.position;
        markStartCommand(context);
        context.isCopyFromStdinCandidate = false;
        break;
      case 'begin':
        if (context.options.skipSeparatorBeginEnd) {
          context.beginEndIdentLevel++;
        }
        movePosition(context, token.length, false);
        break;
      case 'end':
        if (context.options.skipSeparatorBeginEnd && context.beginEndIdentLevel > 0) {
          context.beginEndIdentLevel--;
        }
        movePosition(context, token.length, false);
        break;
    }
  }

  if (context.end > context.currentCommandStart) {
    context.commandPart += context.source.slice(context.currentCommandStart, context.position);
  }
}

export function getInitialDelimiter(options: SplitterOptions) {
  if (options?.adaptiveGoSplit) return SEMICOLON;
  return options?.allowSemicolon === false ? null : SEMICOLON;
}

export function finishSplitStream(context: SplitStreamContext) {
  pushCurrentQueryPart(context);
}

export function splitQuery(sql: string, options: SplitterOptions = null): SplitResultItem[] {
  const usedOptions = {
    ...defaultSplitterOptions,
    ...options,
  };

  if (usedOptions.noSplit) {
    if (usedOptions.returnRichInfo) {
      const lines = sql.split('\n');
      return [
        {
          text: sql,
          start: {
            position: 0,
            line: 0,
            column: 0,
          },
          end: {
            position: sql.length,
            line: lines.length,
            column: lines[lines.length - 1]?.length || 0,
          },
        },
      ];
    }
    return [sql];
  }

  const output = [];
  const context: SplitLineContext = {
    source: sql,
    end: sql.length,
    currentDelimiter: getInitialDelimiter(options),
    position: 0,
    column: 0,
    line: 0,
    currentCommandStart: 0,
    commandStartLine: 0,
    commandStartColumn: 0,
    commandStartPosition: 0,
    streamPosition: 0,

    noWhiteLine: 0,
    noWhiteColumn: 0,
    noWhitePosition: 0,

    trimCommandStartPosition: 0,
    trimCommandStartLine: 0,
    trimCommandStartColumn: 0,
    beginEndIdentLevel: 0,

    wasDataInCommand: false,
    isCopyFromStdin: false,
    isCopyFromStdinCandidate: false,

    pushOutput: cmd => output.push(cmd),
    wasDataOnLine: false,
    options: usedOptions,
    commandPart: '',
  };

  splitQueryLine(context);
  finishSplitStream(context);

  return output;
}
