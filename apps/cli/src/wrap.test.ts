import { describe, expect, test } from "bun:test";
import { captureStreams } from "./fixtures";
import { wrapCommand } from "./wrap";

describe("wrap", () => {
  describe("wrapCommand", () => {
    test("serializes handler result as JSON to stdout", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ items: [1, 2, 3] }), {
        stdout: streams.stdout,
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stdoutMessages[0] ?? "null");
      expect(parsed).toEqual({ items: [1, 2, 3] });
    });

    test("serializes null result as JSON null", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => null, { stdout: streams.stdout });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.stdoutMessages[0]).toBe("null");
    });

    test("serializes a string result", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => "hello", { stdout: streams.stdout });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.stdoutMessages[0]).toBe('"hello"');
    });

    test("serializes an array result", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => [{ name: "A" }, { name: "B" }], {
        stdout: streams.stdout,
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stdoutMessages[0] ?? "[]");
      expect(parsed).toEqual([{ name: "A" }, { name: "B" }]);
    });

    test("writes error JSON to stderr when handler throws an Error", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw new Error("Database unreachable");
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stderrMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stderrMessages[0] ?? "{}") as {
        error: string;
      };
      expect(parsed.error).toBe("Database unreachable");
    });

    test("writes error JSON to stderr when handler throws a string", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw "Something went wrong";
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stderrMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stderrMessages[0] ?? "{}") as {
        error: string;
      };
      expect(parsed.error).toBe("Something went wrong");
    });

    test("writes error JSON to stderr when handler throws a number", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw 404;
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stderrMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stderrMessages[0] ?? "{}") as {
        error: string;
      };
      expect(parsed.error).toBe("404");
    });

    test("writes error JSON to stderr when handler throws an object", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw { code: 500 };
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stderrMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stderrMessages[0] ?? "{}") as {
        error: string;
      };
      expect(parsed.error).toBe("[object Object]");
    });

    test("exits with code 1 on error", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw new Error("fail");
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.exitCode()).toBe(1);
    });

    test("exits with code from getExitCode when result has partial failures", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ total: 10, failed: 3 }), {
        stdout: streams.stdout,
        exit: streams.exit,
        getExitCode: (result) => {
          const r = result as { failed: number };
          return r.failed > 0 ? 3 : 0;
        },
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.exitCode()).toBe(3);
    });

    test("does not exit when getExitCode returns zero", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ total: 5, failed: 0 }), {
        stdout: streams.stdout,
        exit: streams.exit,
        getExitCode: (result) => {
          const r = result as { failed: number };
          return r.failed > 0 ? 3 : 0;
        },
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.exitCode()).toBeUndefined();
    });

    test("does not exit when getExitCode is not provided", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ ok: true }), {
        stdout: streams.stdout,
        exit: streams.exit,
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.exitCode()).toBeUndefined();
    });

    test("passes the result to getExitCode", async () => {
      const streams = captureStreams();
      let received: unknown;

      await wrapCommand(async () => ({ status: "partial" }), {
        stdout: streams.stdout,
        exit: streams.exit,
        getExitCode: (result) => {
          received = result;
          return 0;
        },
      });

      expect(received).toEqual({ status: "partial" });
    });

    test("uses exit code 3 for partial failures with custom getExitCode", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ results: [{ status: "failed" }, { status: "matched" }] }), {
        stdout: streams.stdout,
        exit: streams.exit,
        getExitCode: (result) => {
          const r = result as { results: Array<{ status: string }> };
          const failedCount = r.results.filter((x) => x.status === "failed").length;
          return failedCount > 0 ? 3 : 0;
        },
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.exitCode()).toBe(3);
    });

    test("writes stdout and does not write stderr on success", async () => {
      const streams = captureStreams();

      await wrapCommand(async () => ({ ok: true }), {
        stdout: streams.stdout,
        stderr: streams.stderr,
      });

      expect(streams.stdoutMessages).toHaveLength(1);
      expect(streams.stderrMessages).toHaveLength(0);
    });

    test("does not write stdout on error", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw new Error("fail");
        },
        {
          stdout: streams.stdout,
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stdoutMessages).toHaveLength(0);
      expect(streams.stderrMessages).toHaveLength(1);
    });

    test("handles an Error with an empty message", async () => {
      const streams = captureStreams();

      await wrapCommand(
        async () => {
          throw new Error();
        },
        {
          stderr: streams.stderr,
          exit: streams.exit,
        },
      );

      expect(streams.stderrMessages).toHaveLength(1);
      const parsed = JSON.parse(streams.stderrMessages[0] ?? "{}") as {
        error: string;
      };
      expect(parsed.error).toBe("");
    });

    test("sends handler writes to stderr when redirecting", async () => {
      const origStdoutWrite = process.stdout.write;
      const origStderrWrite = process.stderr.write;
      const stdoutMessages: string[] = [];
      const stderrMessages: string[] = [];

      try {
        process.stdout.write = ((chunk: unknown) => {
          stdoutMessages.push(String(chunk));
          return true;
        }) as typeof process.stdout.write;
        process.stderr.write = ((chunk: unknown) => {
          stderrMessages.push(String(chunk));
          return true;
        }) as typeof process.stderr.write;

        await wrapCommand(
          async () => {
            process.stdout.write("should go to stderr");
            return { ok: true };
          },
          { stdout: () => {}, redirectStdout: true },
        );

        expect(stdoutMessages).toHaveLength(0);
        expect(stderrMessages).toHaveLength(1);
        expect(stderrMessages[0]).toBe("should go to stderr");
      } finally {
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
      }
    });

    test("serializes result to stdout after redirect completes", async () => {
      const origStdoutWrite = process.stdout.write;
      const origStderrWrite = process.stderr.write;
      const stdoutMessages: string[] = [];
      const stderrMessages: string[] = [];

      try {
        process.stdout.write = ((chunk: unknown) => {
          stdoutMessages.push(String(chunk));
          return true;
        }) as typeof process.stdout.write;
        process.stderr.write = ((chunk: unknown) => {
          stderrMessages.push(String(chunk));
          return true;
        }) as typeof process.stderr.write;

        const streams = captureStreams();
        await wrapCommand(
          async () => {
            process.stdout.write("progress");
            return { done: 1 };
          },
          { stdout: streams.stdout, redirectStdout: true },
        );

        expect(stdoutMessages).toHaveLength(0);
        expect(stderrMessages).toEqual(["progress"]);
        expect(streams.stdoutMessages).toHaveLength(1);
        expect(streams.stdoutMessages[0]).toBe('{"done":1}');
      } finally {
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
      }
    });

    test("restores stdout after handler throws with redirect", async () => {
      const origWrite = process.stdout.write;

      await wrapCommand(
        async () => {
          throw new Error("boom");
        },
        { stderr: () => {}, exit: () => {}, redirectStdout: true },
      );

      expect(process.stdout.write).toBe(origWrite);
    });
  });
});
