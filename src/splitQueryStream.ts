import stream from 'stream';
import {
  SplitStreamContext,
  getInitialDelimiter,
  SplitLineContext,
  splitQueryLine,
  finishSplitStream,
} from './splitQuery';
import { SplitterOptions } from './options';

export class SplitQueryStream extends stream.Transform {
  context: SplitStreamContext;

  constructor(options: SplitterOptions) {
    super({ objectMode: true });
    this.context = {
      commandPart: '',
      commandStartLine: 0,
      commandStartColumn: 0,
      commandStartPosition: 0,
      streamPosition: 0,
      line: 0,
      column: 0,
      options,
      currentDelimiter: getInitialDelimiter(options),
      pushOutput: cmd => this.push(cmd),
    };
  }
  _transform(chunk, encoding, done) {
    const lineContext: SplitLineContext = {
      ...this.context,
      position: 0,
      currentCommandStart: 0,
      wasDataOnLine: false,
      source: chunk,
      end: chunk.length,
    };
    splitQueryLine(lineContext);
    this.context.commandPart = lineContext.commandPart;
    done();
  }
  _flush(done) {
    finishSplitStream(this.context);
    done();
  }
}

export function splitQueryStream(sourceStream, options: SplitterOptions) {
  const splitter = new SplitQueryStream(options);
  sourceStream.pipe(splitter);
  return splitter;
}
