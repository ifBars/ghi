declare module "qrcode-terminal" {
  export type QrcodeTerminal = {
    generate(input: string, options?: { small?: boolean }, callback?: (qr: string) => void): void;
    setErrorLevel(error: "L" | "M" | "Q" | "H"): void;
  };
}
