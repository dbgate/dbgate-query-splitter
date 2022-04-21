import stream from "stream";
import {
  SplitStreamContext,
  getInitialDelimiter,
  SplitLineContext,
  splitQueryLine,
  finishSplitStream,
} from "./splitQuery";
import { SplitterOptions } from "./options";

export class SplitQueryStream extends stream.Transform {
  context: SplitStreamContext;
  lineBuffer: string;

  constructor(options: SplitterOptions) {
    super({ objectMode: true });
    this.context = {
      commandPart: "",
      commandStartLine: 0,
      commandStartColumn: 0,
      commandStartPosition: 0,
      streamPosition: 0,
      line: 0,
      column: 0,
      options,
      currentDelimiter: getInitialDelimiter(options),
      pushOutput: (cmd) => this.push(cmd),
    };
    this.lineBuffer = "";
  }

  flushBuffer() {
    const lineContext: SplitLineContext = {
      ...this.context,
      position: 0,
      currentCommandStart: 0,
      wasDataOnLine: false,
      source: this.lineBuffer,
      end: this.lineBuffer.length,
    };
    splitQueryLine(lineContext);
    this.context.commandPart = lineContext.commandPart;
    this.context.currentDelimiter = lineContext.currentDelimiter;
    this.lineBuffer = "";
  }

  _transform(chunk, encoding, done) {
    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];
      this.lineBuffer += ch;
      if (ch == "\n") {
        this.flushBuffer();
      }
    }

    done();
  }
  _flush(done) {
    this.flushBuffer();
    finishSplitStream(this.context);
    done();
  }
}

export function splitQueryStream(sourceStream, options: SplitterOptions) {
  const splitter = new SplitQueryStream(options);
  sourceStream.pipe(splitter);
  return splitter;
}
