export interface InputEvent {
  type: "mouse" | "keyboard";
  action: "move" | "click" | "scroll" | "keydown" | "keyup" | "type";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  key?: string;
  text?: string;
  delta?: number;
  source: "user" | "ai";
}

export class InputHandler {
  private robot: any = null;
  private isEnabled = true;

  constructor() {
    this.loadRobotModule();
  }

  private async loadRobotModule(): Promise<void> {
    try {
      this.robot = await import("robotjs");
    } catch (error) {
      console.warn("robotjs not available - input injection disabled");
      console.warn("Install with: npm install robotjs");
      this.robot = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  handleInput(event: InputEvent): void {
    if (!this.isEnabled || !this.robot) {
      console.log(`Input event (not executed):`, event);
      return;
    }

    try {
      switch (event.type) {
        case "mouse":
          this.handleMouseEvent(event);
          break;
        case "keyboard":
          this.handleKeyboardEvent(event);
          break;
      }
    } catch (error) {
      console.error("Input handling error:", error);
    }
  }

  private handleMouseEvent(event: InputEvent): void {
    if (!this.robot) return;

    switch (event.action) {
      case "move":
        if (event.x !== undefined && event.y !== undefined) {
          this.robot.moveMouse(event.x, event.y);
        }
        break;

      case "click":
        if (event.x !== undefined && event.y !== undefined) {
          this.robot.moveMouse(event.x, event.y);
        }
        const button = event.button || "left";
        this.robot.mouseClick(button);
        break;

      case "scroll":
        if (event.delta !== undefined) {
          this.robot.scrollMouse(0, event.delta);
        }
        break;
    }
  }

  private handleKeyboardEvent(event: InputEvent): void {
    if (!this.robot) return;

    switch (event.action) {
      case "keydown":
        if (event.key) {
          this.robot.keyToggle(this.mapKey(event.key), "down");
        }
        break;

      case "keyup":
        if (event.key) {
          this.robot.keyToggle(this.mapKey(event.key), "up");
        }
        break;

      case "type":
        if (event.text) {
          this.robot.typeString(event.text);
        }
        break;
    }
  }

  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      Enter: "enter",
      Escape: "escape",
      Backspace: "backspace",
      Tab: "tab",
      Space: "space",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Control: "control",
      Alt: "alt",
      Shift: "shift",
      Meta: "command",
      Delete: "delete",
      Home: "home",
      End: "end",
      PageUp: "pageup",
      PageDown: "pagedown",
    };

    return keyMap[key] || key.toLowerCase();
  }
}
