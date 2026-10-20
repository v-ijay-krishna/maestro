import { MidiDeviceInfo } from '@maestro/shared';
import { MidiDeviceManager } from './MidiDeviceManager';
import { parseMidiMessage } from './MidiEventParser';
import { midiEventStream } from './MidiEventStream';

/**
 * Web MIDI API -> MidiDeviceManager -> MidiEventParser -> MidiEventStream
 * wired together, exactly per the Section 23 diagram. This is the single
 * entry point the rest of the frontend should import.
 */
export class MidiEngine {
  private deviceManager = new MidiDeviceManager();

  isSupported(): boolean {
    return this.deviceManager.isSupported();
  }

  async init(): Promise<void> {
    await this.deviceManager.init();
  }

  listDevices(): MidiDeviceInfo[] {
    return this.deviceManager.listInputs();
  }

  onDeviceListChange(handler: (devices: MidiDeviceInfo[]) => void): () => void {
    return this.deviceManager.onDeviceListChange(handler);
  }

  connect(deviceId: string): boolean {
    return this.deviceManager.connect(deviceId, (data, timestamp) => {
      const event = parseMidiMessage(data, timestamp);
      if (event) midiEventStream.ingest(event);
    });
  }

  disconnect(): void {
    this.deviceManager.disconnect();
  }

  getActiveDevice(): MidiDeviceInfo | null {
    return this.deviceManager.getActiveDevice();
  }
}

export const midiEngine = new MidiEngine();
export { midiEventStream } from './MidiEventStream';
