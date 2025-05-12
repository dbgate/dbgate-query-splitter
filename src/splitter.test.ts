import {
  mysqlSplitterOptions,
  mssqlSplitterOptions,
  postgreSplitterOptions,
  mongoSplitterOptions,
  noSplitSplitterOptions,
  redisSplitterOptions,
  oracleSplitterOptions,
  sqliteSplitterOptions,
} from './options';
import { splitQuery } from './splitQuery';

test('simple query', () => {
  const output = splitQuery('select * from A');
  expect(output).toEqual(['select * from A']);
});

test('correct split 2 queries', () => {
  const output = splitQuery('SELECT * FROM `table1`;SELECT * FROM `table2`;', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('correct split 2 queries - no end semicolon', () => {
  const output = splitQuery('SELECT * FROM `table1`;SELECT * FROM `table2`', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('correct split 2 queries - with escaped string', () => {
  const output = splitQuery(
    "INSERT INTO names (name) VALUES('one\\\\');INSERT INTO names (name) VALUES('two\\\\');",
    mysqlSplitterOptions
  );
  expect(output).toEqual(["INSERT INTO names (name) VALUES('one\\\\')", "INSERT INTO names (name) VALUES('two\\\\')"]);
});

test('mysql - use quote styles', () => {
  const output = splitQuery(`SELECT "'";SELECT '"';SELECT 3`, mysqlSplitterOptions);
  expect(output).toEqual([`SELECT "'"`, `SELECT '"'`, `SELECT 3`]);
});

test('incorrect used escape', () => {
  const output = splitQuery('query1\\', mysqlSplitterOptions);
  expect(output).toEqual(['query1\\']);
});

test('delete empty query', () => {
  const output = splitQuery(';;;\n;;SELECT * FROM `table1`;;;;;SELECT * FROM `table2`;;; ;;;', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('should handle double backtick', () => {
  const input = ['CREATE TABLE `a``b` (`c"d` INT)', 'CREATE TABLE `a````b` (`c"d` INT)'];
  const output = splitQuery(input.join(';\n') + ';', mysqlSplitterOptions);
  expect(output).toEqual(input);
});

test('semicolon inside string', () => {
  const input = ['CREATE TABLE a', "INSERT INTO a (x) VALUES ('1;2;3;4')"];
  const output = splitQuery(input.join(';\n') + ';', mysqlSplitterOptions);
  expect(output).toEqual(input);
});

test('semicolon inside identyifier - mssql', () => {
  const input = ['CREATE TABLE [a;1]', "INSERT INTO [a;1] (x) VALUES ('1')"];
  const output = splitQuery(input.join(';\n') + ';', {
    ...mssqlSplitterOptions,
    allowSemicolon: true,
  });
  expect(output).toEqual(input);
});

test('prevent single line split - mysql', () => {
  const output = splitQuery('SELECT * FROM `table1`;SELECT * FROM `table2`;\nSELECT * FROM `table3`', {
    ...mysqlSplitterOptions,
    preventSingleLineSplit: true,
  });
  expect(output).toEqual(['SELECT * FROM `table1`;SELECT * FROM `table2`', 'SELECT * FROM `table3`']);
});

test('prevent single line split - mysql with comments', () => {
  const output = splitQuery('SELECT 1; -- comm 1\nSELECT 2', {
    ...mysqlSplitterOptions,
    preventSingleLineSplit: true,
  });
  expect(output).toEqual(['SELECT 1', '-- comm 1\nSELECT 2']);
});

test('prevent single line split - mysql with comments ignored', () => {
  const output = splitQuery('SELECT 1; -- comm 1\nSELECT 2', {
    ...mysqlSplitterOptions,
    preventSingleLineSplit: true,
    ignoreComments: true,
  });
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('adaptive go split -mssql', () => {
  const output = splitQuery(
    'SELECT 1;CREATE PROCEDURE p1 AS BEGIN SELECT 2;SELECT 3;END\nGO\nSELECT 4;SELECT 5;ALTER PROCEDURE p1 AS BEGIN SELECT 2;SELECT 3;END',
    {
      ...mssqlSplitterOptions,
      adaptiveGoSplit: true,
    }
  );
  expect(output).toEqual([
    'SELECT 1',
    'CREATE PROCEDURE p1 AS BEGIN SELECT 2;SELECT 3;END',
    'SELECT 4',
    'SELECT 5',
    'ALTER PROCEDURE p1 AS BEGIN SELECT 2;SELECT 3;END',
  ]);
});

test('delimiter test', () => {
  const input = 'SELECT 1;\n DELIMITER $$\n SELECT 2; SELECT 3; \n DELIMITER ;';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2; SELECT 3;']);
});

test('one line comment test', () => {
  const input = 'SELECT 1 -- comment1;comment2\n;SELECT 2';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1 -- comment1;comment2', 'SELECT 2']);
});

test('multi line comment test', () => {
  const input = 'SELECT 1 /* comment1;comment2\ncomment3*/;SELECT 2';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1 /* comment1;comment2\ncomment3*/', 'SELECT 2']);
});

test('dollar string', () => {
  const input = 'CREATE PROC $$ SELECT 1; SELECT 2; $$ ; SELECT 3';
  const output = splitQuery(input, postgreSplitterOptions);
  expect(output).toEqual(['CREATE PROC $$ SELECT 1; SELECT 2; $$', 'SELECT 3']);
});

test('go delimiter', () => {
  const input = 'SELECT 1\ngo\nSELECT 2';
  const output = splitQuery(input, mssqlSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('no split', () => {
  const input = 'SELECT 1;SELECT 2';
  const output = splitQuery(input, noSplitSplitterOptions);
  expect(output).toEqual(['SELECT 1;SELECT 2']);
});

test('split mongo', () => {
  const input = 'db.collection.insert({x:1});db.collection.insert({y:2})';
  const output = splitQuery(input, mongoSplitterOptions);
  expect(output).toEqual(['db.collection.insert({x:1})', 'db.collection.insert({y:2})']);
});

test('redis split by newline', () => {
  const output = splitQuery('SET x 1\nSET y 2', redisSplitterOptions);
  expect(output).toEqual(['SET x 1', 'SET y 2']);
});

test('redis split by newline 2', () => {
  const output = splitQuery('SET x 1\n\nSET y 2\n', redisSplitterOptions);
  expect(output).toEqual(['SET x 1', 'SET y 2']);
});

test('count lines', () => {
  const output = splitQuery('SELECT * FROM `table1`;\nSELECT * FROM `table2`;', {
    ...mysqlSplitterOptions,
    returnRichInfo: true,
  });
  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'SELECT * FROM `table1`',

        trimStart: expect.objectContaining({
          position: 0,
          line: 0,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 22,
          line: 0,
          column: 22,
        }),
      }),
      expect.objectContaining({
        text: 'SELECT * FROM `table2`',

        trimStart: expect.objectContaining({
          position: 24,
          line: 1,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 46,
          line: 1,
          column: 22,
        }),
      }),
    ])
  );
});

test('count lines with flush', () => {
  const output = splitQuery('SELECT * FROM `table1`;\nSELECT * FROM `table2`', {
    ...mysqlSplitterOptions,
    returnRichInfo: true,
  });
  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'SELECT * FROM `table1`',

        trimStart: expect.objectContaining({
          position: 0,
          line: 0,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 22,
          line: 0,
          column: 22,
        }),
      }),
      expect.objectContaining({
        text: 'SELECT * FROM `table2`',

        trimStart: expect.objectContaining({
          position: 24,
          line: 1,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 46,
          line: 1,
          column: 22,
        }),
      }),
    ])
  );
});

test('empty line delimiter', () => {
  const input = 'SELECT 1\n\n   \nSELECT 2\n';
  const output = splitQuery(input, { ...mysqlSplitterOptions, splitByEmptyLine: true });
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('empty line delimiter - 2 lines', () => {
  const input = 'SELECT 1\n\n   \nSELECT 2\nSELECT 3\n';
  const output = splitQuery(input, { ...mysqlSplitterOptions, splitByEmptyLine: true });
  expect(output).toEqual(['SELECT 1', 'SELECT 2\nSELECT 3']);
});

test('shash delimiter', () => {
  const input = 'SELECT 1\n/\nSELECT 2\n';
  const output = splitQuery(input, oracleSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('go delimiter on the end', () => {
  const input = 'SELECT 1\nGO';
  const output = splitQuery(input, mssqlSplitterOptions);
  expect(output).toEqual(['SELECT 1']);
});

test('oracle procedure', () => {
  const input = 'SET SQLT OFF\nCREATE PROC1\nSELECT 1;\nEND\n/';
  const output = splitQuery(input, oracleSplitterOptions);
  expect(output).toEqual(['CREATE PROC1\nSELECT 1;\nEND']);
});

test('oracle custom terminator', () => {
  const input = 'SET SQLTERMINATOR "%"\nSELECT 1%\nSELECT 2';
  const output = splitQuery(input, oracleSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('postgres copy from stdin', () => {
  const input = 'COPY public."Genre" ("GenreId", "Name") FROM stdin;\n1	Rock\n2	Jazz\n3	Metal\n\\.\nCREATE TABLE xxx';
  const output = splitQuery(input, {
    ...postgreSplitterOptions,
    copyFromStdin: true,
    returnRichInfo: true,
  });

  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'COPY public."Genre" ("GenreId", "Name") FROM stdin',
        specialMarker: 'copy_stdin_start',
      }),
      expect.objectContaining({
        text: '1\tRock\n',
        specialMarker: 'copy_stdin_line',
      }),
      expect.objectContaining({
        text: '2\tJazz\n',
        specialMarker: 'copy_stdin_line',
      }),
      expect.objectContaining({
        text: '3\tMetal\n',
        specialMarker: 'copy_stdin_line',
      }),
      expect.objectContaining({
        specialMarker: 'copy_stdin_end',
      }),
      expect.objectContaining({
        text: 'CREATE TABLE xxx',
      }),
    ])
  );
});

test('sqlite skipSeparatorBeginEnd', () => {
  const input = 'CREATE TRIGGER obj1 AFTER INSERT ON t1 FOR EACH ROW BEGIN SELECT * FROM t1; END';
  const output = splitQuery(input, {
    ...sqliteSplitterOptions,
  });

  expect(output.length).toBe(1);
  expect(output[0]).toEqual(input);
});

test('sqlite skipSeparatorBeginEnd in lowercase', () => {
  const input = 'create trigger obj1 after insert on t1 for each row begin select * from t1; end';
  const output = splitQuery(input, {
    ...sqliteSplitterOptions,
  });

  expect(output.length).toBe(1);
  expect(output[0]).toEqual(input);
});

test('sqlite skipSeparatorBeginEnd in TRANSACTION', () => {
  const input = `BEGIN TRANSACTION; UPDATE t1 SET x=0;; END;`;
  const output = splitQuery(input, {
    ...sqliteSplitterOptions,
  });

  expect(output.length).toBe(3);
  expect(output[0]).toEqual('BEGIN TRANSACTION');
  expect(output[1]).toEqual('UPDATE t1 SET x=0');
  expect(output[2]).toEqual('END');
});

test('sqlite skipSeparatorBeginEnd in TRANSACTION in lowercase', () => {
  const input = `begin transaction; update t1 set x=0;; end;`;
  const output = splitQuery(input, {
    ...sqliteSplitterOptions,
  });

  expect(output.length).toBe(3);
  expect(output[0]).toEqual('begin transaction');
  expect(output[1]).toEqual('update t1 set x=0');
  expect(output[2]).toEqual('end');
});
