export type WindowProcessTarget = {
  pid: number;
  processName: string;
  windowTitle: string;
  executablePath: string;
  windowHandle: number;
  windowClass: string;
  closeWindowOnly: boolean;
};
