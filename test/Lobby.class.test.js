import { jest } from "@jest/globals";

import config from "../config.js";
import telegramBot from "../src/TelegramBot.class.js";

globalThis.CONFIG = config;

jest.setTimeout(60000);
test('build', async () => {
    await telegramBot.build();
});