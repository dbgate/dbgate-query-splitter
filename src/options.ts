export type QueryParameterStyle = null | '?' | '$' | '@' | ':' | '#';

export interface SplitterOptions {
  stringsBegins: string[];
  stringsEnds: { [begin: string]: string };
  stringEscapes: { [begin: string]: string };

  allowSemicolon: boolean;
  allowCustomDelimiter: boolean;
  allowCustomSqlTerminator: boolean;
  allowGoDelimiter: boolean;
  allowSlashDelimiter: boolean;
  allowDollarDollarString: boolean;
  noSplit: boolean;
  doubleDashComments: boolean;
  multilineComments: boolean;
  javaScriptComments: boolean;
  skipSeparatorBeginEnd: boolean;
  // comments willl be not part of output
  ignoreComments: boolean;
  // if more commands are on single line, they are not splitted
  preventSingleLineSplit: boolean;
  // overrides allowSemicolon, allowGoDelimiter setting. splits by semicolon, after CREATE PROCEDURE, CREATE FUNCTION, GO separator is required
  adaptiveGoSplit: boolean;

  returnRichInfo: boolean;
  splitByLines: boolean;

  copyFromStdin: boolean;

  queryParameterStyle: QueryParameterStyle;
}

export const defaultSplitterOptions: SplitterOptions = {
  stringsBegins: ["'"],
  stringsEnds: { "'": "'" },
  stringEscapes: { "'": "'" },

  allowSemicolon: true,
  allowCustomDelimiter: false,
  allowCustomSqlTerminator: false,
  allowGoDelimiter: false,
  allowSlashDelimiter: false,
  allowDollarDollarString: false,
  noSplit: false,
  skipSeparatorBeginEnd: false,

  doubleDashComments: true,
  multilineComments: true,
  javaScriptComments: false,

  returnRichInfo: false,
  splitByLines: false,
  preventSingleLineSplit: false,
  adaptiveGoSplit: false,
  ignoreComments: false,

  copyFromStdin: false,
  queryParameterStyle: null,
};

export const mysqlSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  allowCustomDelimiter: true,
  stringsBegins: ["'", '`'],
  stringsEnds: { "'": "'", '`': '`' },
  stringEscapes: { "'": '\\', '`': '`' },
};

export const mssqlSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,
  allowSemicolon: false,
  allowGoDelimiter: true,

  stringsBegins: ["'", '['],
  stringsEnds: { "'": "'", '[': ']' },
  stringEscapes: { "'": "'" },
};

export const postgreSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  allowDollarDollarString: true,

  stringsBegins: ["'", '"'],
  stringsEnds: { "'": "'", '"': '"' },
  stringEscapes: { "'": "'", '"': '"' },
};

export const sqliteSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  skipSeparatorBeginEnd: true,
  stringsBegins: ["'", '"'],
  stringsEnds: { "'": "'", '"': '"' },
  stringEscapes: { "'": "'", '"': '"' },
};

export const mongoSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  stringsBegins: ["'", '"'],
  stringsEnds: { "'": "'", '"': '"' },
  stringEscapes: { "'": '\\', '"': '\\' },
};

export const noSplitSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  noSplit: true,
};

export const redisSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  splitByLines: true,
};

export const oracleSplitterOptions: SplitterOptions = {
  ...defaultSplitterOptions,

  allowCustomSqlTerminator: true,
  allowSlashDelimiter: true,

  stringsBegins: ["'", '"'],
  stringsEnds: { "'": "'", '"': '"' },
  stringEscapes: { "'": "'", '"': '"' },
};
