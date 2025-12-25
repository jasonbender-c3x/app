interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  details?: string;
}

class LogBuffer {
  private logs: LogEntry[] = [];
  private maxSize = 100;
  private counter = 0;

  add(level: LogEntry["level"], message: string, details?: string) {
    this.counter++;
    const entry: LogEntry = {
      id: `log-${Date.now()}-${this.counter}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.maxSize) {
      this.logs.pop();
    }
  }

  info(message: string, details?: string) {
    this.add("info", message, details);
  }

  warn(message: string, details?: string) {
    this.add("warn", message, details);
  }

  error(message: string, details?: string) {
    this.add("error", message, details);
  }

  debug(message: string, details?: string) {
    this.add("debug", message, details);
  }

  getLogs(limit = 50): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  clear() {
    this.logs = [];
  }
}

export const logBuffer = new LogBuffer();
