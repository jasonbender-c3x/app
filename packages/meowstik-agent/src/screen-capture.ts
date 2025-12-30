export interface ScreenFrame {
  width: number;
  height: number;
  data: string;
}

export class ScreenCapture {
  private quality: number;
  private screenshotDesktop: any = null;

  constructor(quality: number = 60) {
    this.quality = quality;
  }

  private async loadScreenshotModule(): Promise<void> {
    if (!this.screenshotDesktop) {
      try {
        this.screenshotDesktop = await import("screenshot-desktop");
      } catch (error) {
        console.warn("screenshot-desktop not available, using fallback");
        this.screenshotDesktop = null;
      }
    }
  }

  async capture(): Promise<ScreenFrame | null> {
    try {
      await this.loadScreenshotModule();

      if (this.screenshotDesktop) {
        const screenshot = await this.screenshotDesktop.default({
          format: "png",
        });

        const base64 = screenshot.toString("base64");

        return {
          width: 1920,
          height: 1080,
          data: base64,
        };
      }

      return this.createPlaceholderFrame();
    } catch (error) {
      console.error("Screen capture error:", error);
      return this.createPlaceholderFrame();
    }
  }

  private createPlaceholderFrame(): ScreenFrame {
    return {
      width: 800,
      height: 600,
      data: "",
    };
  }

  async getDisplays(): Promise<Array<{ id: string; name: string; width: number; height: number }>> {
    try {
      await this.loadScreenshotModule();
      if (this.screenshotDesktop) {
        const displays = await this.screenshotDesktop.listDisplays();
        return displays.map((d: any, i: number) => ({
          id: String(d.id || i),
          name: d.name || `Display ${i + 1}`,
          width: d.width || 1920,
          height: d.height || 1080,
        }));
      }
    } catch (error) {
      console.error("Error listing displays:", error);
    }
    return [{ id: "0", name: "Primary", width: 1920, height: 1080 }];
  }
}
