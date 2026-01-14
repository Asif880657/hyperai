
export enum Tone {
  CASUAL = 'Casual',
  FORMAL = 'Formal',
  HUMOROUS = 'Humorous',
  PROFESSIONAL = 'Professional'
}

export enum Voice {
  ZEPHYR = 'Zephyr',
  PUCK = 'Puck',
  CHARON = 'Charon',
  KORE = 'Kore',
  FENRIR = 'Fenrir'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface AppSettings {
  tone: Tone;
  voice: Voice;
  language: string;
}
