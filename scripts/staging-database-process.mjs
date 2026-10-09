import {spawn} from 'node:child_process';

// Keep libpq diagnostics in memory and allow independent HTTPS checks to finish
// while PostgreSQL runs. The caller supplies the isolated read-only environment.
export function executeDatabaseProcess(command, args, options) {
  return new Promise((resolve) => {
    const output = [], diagnostic = [];
    let bytes = 0, failed = false, finished = false, inputClosedEarly = false, timer, killTimer;
    const child = spawn(command, args, {env:options.env, stdio:['pipe', 'pipe', 'pipe']});
    const finish = (status) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearTimeout(killTimer);
      if (inputClosedEarly && status !== 0) failed = true;
      if (failed) {child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();}
      resolve({status, ...(failed ? {error:true} : {}), ...(inputClosedEarly ? {inputClosedEarly:true} : {}),
        stdout:failed ? '' : Buffer.concat(output).toString('utf8'),
        stderr:Buffer.concat(diagnostic).toString('utf8')});
    };
    const stop = () => {
      if (finished) return;
      failed = true;
      child.kill('SIGTERM');
      // A descendant can retain pipes after the main child exits. Bound that
      // case too: drain no further data and return failure after the kill grace.
      killTimer ??= setTimeout(() => {
        child.kill('SIGKILL');
        finish(null);
      }, 1_000);
    };
    const receive = (chunks) => (chunk) => {
      if (finished) return;
      bytes += chunk.length;
      if (bytes > options.maxBuffer) {stop(); return;}
      chunks.push(chunk);
    };
    child.stdout.on('data', receive(output));
    child.stderr.on('data', receive(diagnostic));
    child.stdin.on('error', (error) => {
      // A selective archive reader may finish before consuming table data.
      // Opt in only for that fixed reader; exit status, stderr, output limits
      // and timeout still determine whether the caller accepts the result.
      if (!finished && error.code === 'EPIPE' && options.allowEarlyInputClose === true) {
        inputClosedEarly = true;
        return;
      }
      stop();
    });
    child.stdout.on('error', stop);
    child.stderr.on('error', stop);
    child.on('error', () => {failed = true; finish(null);});
    // close waits for stdout/stderr completion; exit alone can truncate JSON.
    child.on('close', finish);
    timer = setTimeout(stop, options.timeout);
    child.stdin.end(options.input);
  });
}
