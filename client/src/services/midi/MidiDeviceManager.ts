import { MidiDeviceInfo } from '@maestro/shared';

type RawMidiMessageHandler = (data: Uint8Array, timestamp: number) => void;
type DeviceListChangeHandler = (devices: MidiDeviceInfo[]) => void;

/**
 * Thin wrapper around navigator.requestMIDIAccess. This is the ONLY file
 * that talks to the Web MIDI API directly — everything else consumes
 * normalized types, so swapping transport (e.g. a future WebSocket
 * bridge for non-Chromium browsers) only touches this class.
 */
export class MidiDeviceManager {
  private access: WebMidi.MIDIAccess | null = null;
  private activeInput: WebMidi.MIDIInput | null = null;
  private messageHandler: RawMidiMessageHandler | null = null;
  private deviceListHandlers: Set<DeviceListChangeHandler> = new Set();

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async init(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('WEB_MIDI_UNSUPPORTED');
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.emitDeviceList();
    this.emitDeviceList();
  }

  listInputs(): MidiDeviceInfo[] {
    if (!this.access) return [];
    const devices: MidiDeviceInfo[] = [];
    this.access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name ?? 'Unknown device',
        manufacturer: input.manufacturer ?? undefined,
        state: input.state === 'connected' ? 'connected' : 'disconnected',
        type: 'input',
      });
    });
    return devices;
  }

  connect(deviceId: string, onMessage: RawMidiMessageHandler): boolean {
    if (!this.access) return false;
    const input = this.access.inputs.get(deviceId);
    if (!input) return false;

    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
    }

    this.messageHandler = onMessage;
    input.onmidimessage = (event: WebMidi.MIDIMessageEvent) => {
      this.messageHandler?.(new Uint8Array(event.data), event.timeStamp);
    };
    this.activeInput = input;
    return true;
  }

  disconnect(): void {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
    }
    this.messageHandler = null;
  }

  getActiveDevice(): MidiDeviceInfo | null {
    if (!this.activeInput) return null;
    return {
      id: this.activeInput.id,
      name: this.activeInput.name ?? 'Unknown device',
      manufacturer: this.activeInput.manufacturer ?? undefined,
      state: this.activeInput.state === 'connected' ? 'connected' : 'disconnected',
      type: 'input',
    };
  }

  onDeviceListChange(handler: DeviceListChangeHandler): () => void {
    this.deviceListHandlers.add(handler);
    return () => this.deviceListHandlers.delete(handler);
  }

  private emitDeviceList() {
    const list = this.listInputs();
    this.deviceListHandlers.forEach((h) => h(list));
  }
}
