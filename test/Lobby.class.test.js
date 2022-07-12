import { jest } from "@jest/globals";

import config from "../config.js";
import telegramBot from "../src/TelegramBot.class.js";

globalThis.CONFIG = config;

console.log({imports: telegramBot.imports});

jest.setTimeout(60000);
test('build', async () => {
    console.log( await telegramBot.build() );
});