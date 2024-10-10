import { mysqlSplitterOptions } from './options';
import { extractQueryParameters, replaceQueryParameters } from './queryParamHandler';

test('extract parameters', () => {
  const output = extractQueryParameters('SELECT * FROM `table1` WHERE id = $1;', {
    ...mysqlSplitterOptions,
    queryParameterStyle: '$',
  });
  expect(output).toEqual(['$1']);
});

test('ignore params in string', () => {
  const output = extractQueryParameters("SELECT * FROM `table1` WHERE id = '$1';", {
    ...mysqlSplitterOptions,
    queryParameterStyle: '$',
  });
  expect(output).toEqual([]);
});

test('ignore standalone dollar', () => {
  const output = extractQueryParameters('SELECT * FROM `table1` WHERE id = $;', {
    ...mysqlSplitterOptions,
    queryParameterStyle: '$',
  });
  expect(output).toEqual([]);
});

test('replace parameters', () => {
  const output = replaceQueryParameters(
    "SELECT * FROM `table1` WHERE id = $1 and name = '$1'",
    { $1: 'v1' },
    {
      ...mysqlSplitterOptions,
      queryParameterStyle: '$',
    }
  );
  expect(output).toEqual("SELECT * FROM `table1` WHERE id = v1 and name = '$1'");
});

test('question parameters extract', () => {
  const output = extractQueryParameters('SELECT * FROM ? WHERE id = ?;', {
    ...mysqlSplitterOptions,
    queryParameterStyle: '?',
  });
  expect(output).toEqual(['?1', '?2']);
});

test('question parameters replace', () => {
  const output = replaceQueryParameters(
    'SELECT * FROM ? WHERE id = ?',
    { '?1': 'v1', '?2': 'v2' },
    {
      ...mysqlSplitterOptions,
      queryParameterStyle: '?',
    }
  );
  expect(output).toEqual('SELECT * FROM v1 WHERE id = v2');
});
