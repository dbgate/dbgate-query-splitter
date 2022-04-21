[![NPM version](https://img.shields.io/npm/v/dbgate-query-splitter.svg)](https://www.npmjs.com/package/dbgate-query-splitter)

# dbgate-query-splitter

Splits long SQL query into into particular statements. Designed to have zero dependencies and to be fast. Also supports nodejs-streams.

Supports following SQL dialects:

- MySQL
- PostgreSQL
- SQLite
- Microsoft SQL Server

## Usage

```js
import {
  splitQuery,
  mysqlSplitterOptions,
  mssqlSplitterOptions,
  postgreSplitterOptions,
} from "dbgate-query-splitter";

const output = splitQuery(
  "SELECT * FROM `table1`;SELECT * FROM `table2`;",
  mysqlSplitterOptions
);

// output is ['SELECT * FROM `table1`', 'SELECT * FROM `table2`']
```

## Streaming support in nodejs

Function splitQueryStream accepts input stream and query options. Result is object stream, each object for one splitted query. From version 4.9.0, piping byline stream is not required.

```js
const {
  mysqlSplitterOptions,
  mssqlSplitterOptions,
  postgreSplitterOptions,
} = require("dbgate-query-splitter");
const {
  splitQueryStream,
} = require("dbgate-query-splitter/lib/splitQueryStream");
const fs = require("fs");

const fileStream = fs.createReadStream("INPUT_FILE_NAME", "utf-8");
const splittedStream = splitQueryStream(fileStream, mysqlSplitterOptions);
```

## Return rich info

By default, string array is returned. However, if you need to return row/column number information for splitted commands, use returnRichInfo option:

```js
import { splitQuery, mysqlSplitterOptions } from "dbgate-query-splitter";

const output = splitQuery("SELECT * FROM `table1`;SELECT * FROM `table2`;", {
  ...mysqlSplitterOptions,
  returnRichInfo: true,
});

```

Output is:
```js
[
    {
        text: 'SELECT * FROM `table1`',
        start: { position: 0, line: 0, column: 0 },
        end: { position: 22, line: 0, column: 22 },
        trimStart: { position: 0, line: 0, column: 0 },
        trimEnd: { position: 22, line: 0, column: 22 }
    },
    {
        text: 'SELECT * FROM `table2`',
        start: { position: 23, line: 0, column: 23 },
        end: { position: 46, line: 1, column: 22 },
        trimStart: { position: 24, line: 1, column: 0 },
        trimEnd: { position: 46, line: 1, column: 22 }
    }
]
```

## Contributing

Please run tests before pushing any changes.

```sh
yarn test
```

## Supported syntax

- Comments
- Dollar strings (PostgreSQL)
- GO separators (MS SQL)
- Custom delimiter, setby DELIMITER keyword (MySQL)
